import React from 'react';
const shapes={
  search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  network:<><circle cx="12" cy="5" r="2.3"/><circle cx="5" cy="18" r="2.3"/><circle cx="19" cy="18" r="2.3"/><path d="m11 7-5 9m7-9 5 9M7.5 18h9"/></>,
  route:<><circle cx="6" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="M8.5 6H16a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h2"/></>,
  database:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  filter:<><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/></>,
  reset:<><path d="M4 9a8 8 0 1 1 0 7M4 4v5h5"/></>,
  arrow:<><path d="M5 12h14m-5-5 5 5-5 5"/></>,
  left:<><path d="m15 5-7 7 7 7"/></>,
  chevron:<path d="m8 5 7 7-7 7"/>,
  down:<path d="m6 9 6 6 6-6"/>,
  close:<path d="m6 6 12 12M18 6 6 18"/>,
  bookmark:<path d="M6 4h12v17l-6-4-6 4Z"/>,
  copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/></>,
  focus:<><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/></>,
  plus:<path d="M5 12h14M12 5v14"/>,minus:<path d="M5 12h14"/>,
  eye:<><path d="M2 12c5-9 15-9 20 0-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/></>,
  layers:<><path d="m3 8 9-5 9 5-9 5ZM3 13l9 5 9-5M3 18l9 5 9-5"/></>,
  download:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  camera:<><path d="M3 7h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/></>,
  play:<path d="m8 4 13 8-13 8Z"/>,pause:<><path d="M8 5v14M16 5v14"/></>,
  check:<path d="m5 12 4 4 10-10"/>,
  external:<><path d="M14 3h7v7m0-7L11 13M10 4H4v16h16v-6"/></>,
  info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
  panel:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--panel)"/><circle cx="16" cy="12" r="2" fill="var(--panel)"/><circle cx="8" cy="18" r="2" fill="var(--panel)"/></>,
  cube:<><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10"/></>,
  spark:<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/>,
  swap:<><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>
};
export default function Icon({name,size=18,...props}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]||shapes.network}</svg>;}
export function IconButton({icon,label,active=false,className='',...props}){return <button type="button" className={`icon-button ${active?'active':''} ${className}`} title={label} aria-label={label} aria-pressed={active} {...props}><Icon name={icon}/></button>;}
