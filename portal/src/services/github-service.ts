import type { AxiosResponse } from 'axios'
import axios from 'axios'

import { config } from '../config'
import type { GitHubInviteResult } from '../types'
import { mapGitHubApiError } from './error-interceptor'

export class GitHubService {
  async inviteCollaborator(username: string): Promise<GitHubInviteResult> {
    if (!config.githubToken) {
      throw new Error('GitHub Token cannot be empty')
    }

    const url = `${config.githubApiUrl}/repos/${config.repoOwner}/${config.repoName}/collaborators/${username}`

    try {
      const response: AxiosResponse = await axios.put(
        url,
        { permission: 'pull' },
        {
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      )

      return {
        success: true,
        status: response.status,
        message:
          response.status === 201
            ? 'New invitation sent'
            : 'User permissions updated',
      }
    } catch (error: unknown) {
      throw mapGitHubApiError(error, username)
    }
  }
}
