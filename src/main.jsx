import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class MobileSafeBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,info){console.error('American Football World Chronicle crashed',error,info)}
  resetAutosave=()=>{
    try{window.localStorage?.removeItem('afwc-autosave')}catch{}
    window.location.reload();
  };
  render(){
    if(!this.state.error)return this.props.children;
    return <div style={{minHeight:'100vh',background:'#07111d',color:'#f4f7fb',padding:'28px 18px',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <div style={{maxWidth:620,margin:'8vh auto',border:'1px solid #294057',borderRadius:16,padding:24,background:'#0c1825'}}>
        <div style={{fontSize:11,letterSpacing:'.16em',color:'#ff536c',fontWeight:800}}>MOBILE RECOVERY</div>
        <h1 style={{fontSize:28,margin:'10px 0'}}>The Chronicle hit a browser compatibility error.</h1>
        <p style={{color:'#9fb0c3',lineHeight:1.55}}>Your page is still reachable. This screen prevents a JavaScript error from collapsing into an empty dark background.</p>
        <button onClick={()=>window.location.reload()} style={{marginRight:8,padding:'11px 14px',borderRadius:9,border:'1px solid #35516b',background:'#16283a',color:'#fff'}}>Reload</button>
        <button onClick={this.resetAutosave} style={{padding:'11px 14px',borderRadius:9,border:0,background:'#e31e3a',color:'#fff',fontWeight:800}}>Reset local autosave</button>
        <details style={{marginTop:18,color:'#71879e'}}><summary>Technical detail</summary><pre style={{whiteSpace:'pre-wrap',fontSize:11}}>{String(this.state.error?.message||this.state.error)}</pre></details>
      </div>
    </div>;
  }
}

const root=document.getElementById('root');
createRoot(root).render(<MobileSafeBoundary><App/></MobileSafeBoundary>);
