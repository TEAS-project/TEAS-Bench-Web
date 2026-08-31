import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './teas/Dashboard.jsx'
import Methodology from './teas/Methodology.jsx'
import Research from './Research.jsx'
import Team from './Team.jsx'
import Contact from './Contact.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Share one mounted dashboard across both routes. */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/insights" element={<Dashboard />} />
        <Route path="/methods" element={<Methodology />} />
        <Route path="/publications" element={<Research />} />
        <Route path="/team" element={<Team />} />
        <Route path="/contact" element={<Contact />} />
        {/* Preserve former route names. */}
        <Route path="/methodology" element={<Navigate to="/methods" replace />} />
        <Route path="/analysis" element={<Navigate to="/insights" replace />} />
        <Route path="/research" element={<Navigate to="/publications" replace />} />
        {/* Send unmatched SPA routes to the dashboard. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
