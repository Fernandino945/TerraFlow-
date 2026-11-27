import React from 'react'

export const DashboardSkeleton: React.FC = () => (
  <div className="tf-loading" role="status" aria-label="Cargando el estado del predio">
    <div className="tf-skeleton-overview"><div className="tf-skeleton tf-skeleton--signal" /><div className="tf-skeleton-metrics">{[0, 1, 2].map(item => <div className="tf-skeleton tf-skeleton--metric" key={item} />)}</div></div>
    <div className="tf-skeleton-heading"><span className="tf-skeleton tf-skeleton--eyebrow" /><span className="tf-skeleton tf-skeleton--title" /></div>
    <div className="tf-skeleton-zones">{[0, 1, 2].map(item => <div className="tf-skeleton tf-skeleton--zone" key={item} />)}</div>
    <div className="tf-skeleton tf-skeleton--chart" />
    <span className="tf-skeleton-caption">Conectando con sensores…</span>
  </div>
)
