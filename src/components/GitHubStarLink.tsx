import { Star } from 'lucide-react'

function GitHubStarLink() {
  return (
    <a
      className="github-star-link"
      href="https://github.com/j4ckxyz/meclipse"
      target="_blank"
      rel="noreferrer"
      aria-label="Star Meclipse on GitHub (opens in a new tab)"
    >
      <Star size={14} aria-hidden="true" />
      <span>Star on GitHub</span>
    </a>
  )
}

export default GitHubStarLink
