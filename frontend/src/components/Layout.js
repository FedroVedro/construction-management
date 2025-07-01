import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="App">
      <Navbar />
      <main style={{ 
        flex: 1,
        width: '100%',
        backgroundColor: '#f5f5f5',
        minHeight: 'calc(100vh - 60px)'
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;