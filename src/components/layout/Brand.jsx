import { useState } from 'react';
export default function Brand({ light = false }) {
  const [hasImage, setHasImage] = useState(true);
  return <div className={`brand ${light ? 'brand-light' : ''}`}>
    {hasImage ? <img className="brand-logo" src="/assets/images/logo/logo.png" alt="LPK Duta Persada" onError={() => setHasImage(false)}/> : <span className="brand-monogram" aria-hidden="true">dp<span>.</span></span>}
    <div><strong>LPK Duta Persada</strong><span>YOGYAKARTA</span></div>
  </div>;
}
