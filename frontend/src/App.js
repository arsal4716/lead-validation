import React from 'react';
import LeadPortal from './components/LeadPortal.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="container">
        <div className="row">
          <div className="col-12">
          <LeadPortal/>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;