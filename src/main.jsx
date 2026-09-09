import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
class AppBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error('Neuro Atlas:',error,info);}
  render(){if(this.state.error)return <div className="fatal-boundary" role="alert"><h1>화면을 열지 못했습니다.</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>새로고침</button></div>;return this.props.children;}
}
const root=document.getElementById('root');
if(!root)throw new Error('Missing #root element');
createRoot(root).render(<AppBoundary><App/></AppBoundary>);
