import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const dots = [
    { left: 42, top: 98, size: 14, color: 'rgba(94, 180, 212, 0.55)' },
    { left: 68, top: 78, size: 14, color: 'rgba(94, 180, 212, 0.75)' },
    { left: 90, top: 66, size: 14, color: '#5eb4d4' },
    { left: 112, top: 82, size: 14, color: 'rgba(94, 180, 212, 0.7)' },
    { left: 128, top: 104, size: 14, color: 'rgba(94, 180, 212, 0.5)' },
    { left: 56, top: 118, size: 12, color: 'rgba(94, 180, 212, 0.4)' },
    { left: 104, top: 112, size: 12, color: 'rgba(94, 180, 212, 0.45)' },
    { left: 82, top: 96, size: 12, color: '#5dd39e' },
  ]

  return new ImageResponse(
    (
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#12151c',
          borderRadius: 40,
          border: '2px solid rgba(94, 180, 212, 0.2)',
          position: 'relative',
        }}
      >
        {dots.map((dot, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              borderRadius: '50%',
              background: dot.color,
            }}
          />
        ))}
        <motion.div
          style={{
            position: 'absolute',
            left: 84,
            top: 28,
            width: 24,
            height: 24,
            background: '#5eb4d4',
          }}
        />
      </motion.div>
    ),
    { ...size }
  )
}
