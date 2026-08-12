import { ArrowLeft } from 'lucide-react'
import VisitorCount from '../components/VisitorCount'
import GitHubStarLink from '../components/GitHubStarLink'
import CoverageGlobe from './CoverageGlobe'
import './preview.css'

function GlobePreview() {
  return (
    <div className="immersive-preview globe-preview-page">
      <header className="preview-header">
        <a className="preview-wordmark" href="/preview" aria-label="Meclipse preview home">
          <span className="brand-orbit" aria-hidden="true"><span /></span> meclipse
        </a>
        <span className="prototype-label">Globe prototype</span>
        <a href="/preview" className="leave-preview"><ArrowLeft size={15} /> Back to finder</a>
      </header>
      <main><CoverageGlobe /></main>
      <footer className="preview-footer"><VisitorCount /><GitHubStarLink /></footer>
    </div>
  )
}

export default GlobePreview
