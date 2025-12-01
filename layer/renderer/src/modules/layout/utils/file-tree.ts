import type { TorrentFile } from '~/types/torrent'

export interface FileTreeNode {
  name: string
  fullPath: string
  type: 'file' | 'folder'
  size?: number
  progress?: number
  priority?: number
  index?: number
  children?: FileTreeNode[]
  isExpanded?: boolean
  isSelected?: boolean
  isPartiallySelected?: boolean
}

export type FileSelection = Record<number, boolean>

/**
 * Build a hierarchical file tree from flat file list
 */
export function buildFileTree(files: TorrentFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const pathMap = new Map<string, FileTreeNode>()

  files.forEach((file) => {
    const parts = file.name.split('/')
    let currentPath = ''
    let currentLevel = root

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      let node = pathMap.get(currentPath)

      if (!node) {
        node = {
          name: part,
          fullPath: currentPath,
          type: isFile ? 'file' : 'folder',
          isExpanded: false,
          isSelected: false,
          isPartiallySelected: false,
        }

        if (isFile) {
          node.size = file.size
          node.progress = file.progress
          node.priority = file.priority
          node.index = file.index
          // initialize selection from priority: 0 -> unselected (skip), others selected
          node.isSelected = (file.priority ?? 1) !== 0
        } else {
          node.children = []
        }

        pathMap.set(currentPath, node)
        currentLevel.push(node)
      }

      if (!isFile && node.children) {
        currentLevel = node.children
      }
    })
  })

  // Propagate selection state up to folders (set partial/selected flags)
  for (const node of root) {
    updateSelectionState(node)
  }

  return root
}

/**
 * Calculate folder statistics from children
 */
export function calculateFolderStats(node: FileTreeNode): {
  totalSize: number
  totalFiles: number
  completedSize: number
  selectedFiles: number
} {
  let totalSize = 0
  let totalFiles = 0
  let completedSize = 0
  let selectedFiles = 0

  if (node.type === 'file') {
    return {
      totalSize: node.size || 0,
      totalFiles: 1,
      completedSize: (node.size || 0) * (node.progress || 0),
      selectedFiles: node.isSelected ? 1 : 0,
    }
  }

  if (node.children) {
    node.children.forEach((child) => {
      const stats = calculateFolderStats(child)
      totalSize += stats.totalSize
      totalFiles += stats.totalFiles
      completedSize += stats.completedSize
      selectedFiles += stats.selectedFiles
    })
  }

  return { totalSize, totalFiles, completedSize, selectedFiles }
}

/**
 * Update selection state based on children
 */
export function updateSelectionState(node: FileTreeNode): void {
  if (node.type === 'file') {
    return
  }

  if (node.children && node.children.length > 0) {
    // Update children first
    for (const child of node.children) {
      updateSelectionState(child)
    }

    const selectedCount = node.children.filter(
      (child) => child.isSelected,
    ).length
    const partialCount = node.children.filter(
      (child) => child.isPartiallySelected,
    ).length

    if (selectedCount === node.children.length) {
      node.isSelected = true
      node.isPartiallySelected = false
    } else if (selectedCount > 0 || partialCount > 0) {
      node.isSelected = false
      node.isPartiallySelected = true
    } else {
      node.isSelected = false
      node.isPartiallySelected = false
    }
  }
}

/**
 * Toggle selection for a node and update children/parents
 */
export function toggleNodeSelection(
  tree: FileTreeNode[],
  targetPath: string,
  selected: boolean,
): FileTreeNode[] {
  function updateNode(node: FileTreeNode): FileTreeNode {
    if (node.fullPath === targetPath) {
      const updatedNode = {
        ...node,
        isSelected: selected,
        isPartiallySelected: false,
      }

      // Update all children
      if (updatedNode.children) {
        updatedNode.children = updatedNode.children.map((child) =>
          setNodeAndChildrenSelection(child, selected),
        )
      }

      return updatedNode
    }

    if (node.children) {
      const updatedChildren = node.children.map((child) => updateNode(child))
      const updatedNode = { ...node, children: updatedChildren }

      // Update this node's selection state based on children
      updateSelectionState(updatedNode)

      return updatedNode
    }

    return node
  }

  const newTree = tree.map((node) => updateNode(node))
  for (const node of newTree) {
    updateSelectionState(node)
  }
  return newTree
}

/**
 * Set selection for node and all its children
 */
function setNodeAndChildrenSelection(
  node: FileTreeNode,
  selected: boolean,
): FileTreeNode {
  const updatedNode = {
    ...node,
    isSelected: selected,
    isPartiallySelected: false,
  }

  if (updatedNode.children) {
    updatedNode.children = updatedNode.children.map((child) =>
      setNodeAndChildrenSelection(child, selected),
    )
  }

  return updatedNode
}

/**
 * Get all selected file indices from the tree
 */
export function getSelectedFileIndices(tree: FileTreeNode[]): number[] {
  const indices: number[] = []

  function traverse(node: FileTreeNode) {
    if (node.type === 'file' && node.isSelected && node.index !== undefined) {
      indices.push(node.index)
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  for (const node of tree) {
    traverse(node)
  }
  return indices
}

/**
 * Expand or collapse all nodes in the tree
 */
export function setAllExpanded(
  tree: FileTreeNode[],
  expanded: boolean,
): FileTreeNode[] {
  function updateNode(node: FileTreeNode): FileTreeNode {
    const updatedNode = { ...node }

    if (node.type === 'folder') {
      updatedNode.isExpanded = expanded
    }

    if (node.children) {
      updatedNode.children = node.children.map((child) => updateNode(child))
    }

    return updatedNode
  }

  return tree.map((node) => updateNode(node))
}

/**
 * Toggle expansion state for a specific node
 */
export function toggleNodeExpansion(
  tree: FileTreeNode[],
  targetPath: string,
): FileTreeNode[] {
  function updateNode(node: FileTreeNode): FileTreeNode {
    if (node.fullPath === targetPath) {
      return { ...node, isExpanded: !node.isExpanded }
    }

    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) => updateNode(child)),
      }
    }

    return node
  }

  return tree.map((node) => updateNode(node))
}

/**
 * Merge folder expansion state from previous tree into the next tree.
 * Keeps UI-only expand/collapse state stable across data refreshes.
 */
export function mergeExpansionState(
  previousTree: FileTreeNode[],
  nextTree: FileTreeNode[],
): FileTreeNode[] {
  if (!previousTree || previousTree.length === 0) return nextTree

  const expandedByPath = new Map<string, boolean>()

  function collectExpanded(node: FileTreeNode) {
    if (node.type === 'folder') {
      expandedByPath.set(node.fullPath, !!node.isExpanded)
    }
    if (node.children) {
      for (const child of node.children) collectExpanded(child)
    }
  }

  for (const node of previousTree) {
    collectExpanded(node)
  }

  function applyExpanded(node: FileTreeNode): FileTreeNode {
    const cloned: FileTreeNode = { ...node }
    if (node.type === 'folder') {
      if (expandedByPath.has(node.fullPath)) {
        cloned.isExpanded = expandedByPath.get(node.fullPath) === true
      }
      if (node.children) {
        cloned.children = node.children.map((child) => applyExpanded(child))
      }
    } else if (node.children) {
      // Defensive: files generally don't have children, but preserve shape if present
      cloned.children = node.children.map((child) => applyExpanded(child))
    }
    return cloned
  }

  return nextTree.map((node) => applyExpanded(node))
}
