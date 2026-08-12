import { shareTargets } from '../lib/shareLinks'

type ShareMenuProps = {
  coverage?: number
  text?: string
  className?: string
  label?: string
}

const networks = [
  { name: 'Facebook', key: 'facebook', icon: '/social/facebook.svg' },
  { name: 'Bluesky', key: 'bluesky', icon: '/social/bluesky.svg' },
  { name: 'WhatsApp', key: 'whatsapp', icon: '/social/whatsapp.svg' },
] as const

function homepageUrl(): string {
  return new URL('/', window.location.href).href
}

function eclipseShareText(coverage?: number): string {
  if (coverage === undefined) return 'There isn’t a solar eclipse coming up where I am. Check out yours here:'
  const displayCoverage = Number.isInteger(coverage) ? coverage.toFixed(0) : coverage.toFixed(1)
  return `I can see ${displayCoverage}% of the eclipse where I am! Check out yours here:`
}

function ShareMenu({ coverage, text, className = '', label = 'Share result' }: ShareMenuProps) {
  const url = homepageUrl()
  const targets = shareTargets(url, text ?? eclipseShareText(coverage))

  return (
    <div className={`share-bar ${className}`.trim()} aria-label="Share result">
      <span className="share-label">{label}</span>
      <div className="share-destinations">
        {networks.map((network) => (
          <a
            key={network.key}
            href={targets[network.key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${network.name}`}
            title={`Share on ${network.name}`}
          >
            <img src={network.icon} alt="" aria-hidden="true" />
          </a>
        ))}
      </div>
    </div>
  )
}

export default ShareMenu
