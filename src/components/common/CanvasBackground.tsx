'use client'

import type { FC } from 'react'
import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  opacityDirection: number
  scale: number
  scaleDirection: number
  color: {
    r: number
    g: number
    b: number
  }
}

interface CanvasBackgroundProps {
  className?: string
}

export const CanvasBackground: FC<CanvasBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(void 0)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    // Initialize particles
    const initParticles = () => {
      const particles: Particle[] = []

      // Large floating orbs
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          size: 150 + Math.random() * 100, // 150-250px
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: 0.1 + Math.random() * 0.15,
          opacityDirection: Math.random() > 0.5 ? 1 : -1,
          scale: 1,
          scaleDirection: Math.random() > 0.5 ? 1 : -1,
          color:
            i % 2 === 0
              ? { r: 99, g: 102, b: 241 } // accent color
              : { r: 139, g: 92, b: 246 }, // primary color
        })
      }

      // Medium floating orbs
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          size: 80 + Math.random() * 60, // 80-140px
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: (Math.random() - 0.5) * 0.8,
          opacity: 0.05 + Math.random() * 0.1,
          opacityDirection: Math.random() > 0.5 ? 1 : -1,
          scale: 1,
          scaleDirection: Math.random() > 0.5 ? 1 : -1,
          color:
            i % 2 === 0 ? { r: 99, g: 102, b: 241 } : { r: 139, g: 92, b: 246 },
        })
      }

      // Small floating orbs
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          size: 30 + Math.random() * 40, // 30-70px
          speedX: (Math.random() - 0.5) * 1.2,
          speedY: (Math.random() - 0.5) * 1.2,
          opacity: 0.08 + Math.random() * 0.12,
          opacityDirection: Math.random() > 0.5 ? 1 : -1,
          scale: 1,
          scaleDirection: Math.random() > 0.5 ? 1 : -1,
          color:
            i % 2 === 0 ? { r: 99, g: 102, b: 241 } : { r: 139, g: 92, b: 246 },
        })
      }

      particlesRef.current = particles
    }

    const animate = () => {
      if (!ctx) return

      // Clear canvas
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        // Update position
        particle.x += particle.speedX
        particle.y += particle.speedY

        // Bounce off edges
        if (
          particle.x < -particle.size ||
          particle.x > canvas.offsetWidth + particle.size
        ) {
          particle.speedX *= -1
        }
        if (
          particle.y < -particle.size ||
          particle.y > canvas.offsetHeight + particle.size
        ) {
          particle.speedY *= -1
        }

        // Update opacity with pulsing effect
        particle.opacity += particle.opacityDirection * 0.0008
        if (particle.opacity <= 0.02 || particle.opacity >= 0.25) {
          particle.opacityDirection *= -1
        }

        // Update scale with breathing effect
        particle.scale += particle.scaleDirection * 0.0015
        if (particle.scale <= 0.7 || particle.scale >= 1.4) {
          particle.scaleDirection *= -1
        }

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * particle.scale,
        )

        gradient.addColorStop(
          0,
          `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity})`,
        )
        gradient.addColorStop(
          0.5,
          `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity * 0.3})`,
        )
        gradient.addColorStop(
          1,
          `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0)`,
        )

        // Draw particle
        ctx.beginPath()
        ctx.arc(
          particle.x,
          particle.y,
          particle.size * particle.scale,
          0,
          Math.PI * 2,
        )
        ctx.fillStyle = gradient
        ctx.fill()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    // Initialize
    updateCanvasSize()
    initParticles()
    animate()

    // Handle resize
    const handleResize = () => {
      updateCanvasSize()
      initParticles() // Reinitialize particles for new dimensions
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-[1] ${className || ''}`}
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
