import React, { useState, useEffect } from 'react';
import DynamicLogo from './components/DynamicLogo';
import inputData from '../input.json';

function App() {
  const [data, setData] = useState(inputData);
  const [animate, setAnimate] = useState(true);
  const [size, setSize] = useState(512);
  const [debug, setDebug] = useState(false);

  // Generic update function
  const updateField = (field, value) => {
    setData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Update nested brand_colours
  const updateBrandColour = (key, value) => {
    setData(prev => ({
      ...prev,
      brand_colours: {
        ...prev.brand_colours,
        [key]: value
      }
    }));
  };

  // Update nested design_tokens
  const updateDesignToken = (key, value) => {
    setData(prev => ({
      ...prev,
      design_tokens: {
        ...prev.design_tokens,
        [key]: parseFloat(value)
      }
    }));
  };

  // Update observation
  const updateObservation = (index, field, value) => {
    setData(prev => {
      const newObs = [...prev.observations];
      newObs[index] = { ...newObs[index], [field]: field === 'triggered' ? value : field === 'hurdle_percent' ? parseInt(value) : value };
      return { ...prev, observations: newObs };
    });
  };

  // Randomize all values
  const randomizeAll = () => {
    const counterparties = ['Morgan Stanley', 'Goldman Sachs', 'JP Morgan', 'Barclays', 'HSBC', 'Credit Suisse', 'Deutsche Bank'];
    const planNames = ['Mariana 10:10 – FTSE', 'Atlantic 8:8 – S&P', 'Pacific 5:5 – DAX', 'Nordic 6:6 – OMX', 'Alpine 7:7 – SMI'];
    
    const randomDate = (start, end) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
      return new Date(randomTime).toISOString().split('T')[0];
    };

    const startDate = randomDate('2020-01-01', '2025-06-01');
    const tenorYears = Math.floor(Math.random() * 8) + 3; // 3-10 years
    
    // Calculate end date based on tenor years
    const startDateObj = new Date(startDate);
    const endYear = startDateObj.getFullYear() + tenorYears;
    const endDateStr = `${endYear}-12-31`;
    
    // Current date should be within the plan years, biased toward center
    // Use a normal-ish distribution by averaging two random values
    const planStartTime = startDateObj.getTime();
    const planEndTime = new Date(endDateStr).getTime();
    const r1 = Math.random();
    const r2 = Math.random();
    const centralBias = (r1 + r2) / 2; // This gives a bell-curve-ish distribution centered at 0.5
    const currentDateTime = planStartTime + centralBias * (planEndTime - planStartTime);
    const currentDate = new Date(currentDateTime).toISOString().split('T')[0];
    
    // Initial strike level around 7400 (actual index value)
    // Random range: 6500-8500
    const initialStrike = Math.floor(Math.random() * 2000) + 6500;
    // Current level around 8290 (actual index value)
    // Random range: 70%-130% of initial strike to give meaningful performance spread
    const currentLevelMultiplier = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    const currentLevel = Math.floor(initialStrike * currentLevelMultiplier);

    // Generate random observations - one per calendar year from start year
    // Each observation is at a random date within that calendar year
    const observations = [];
    const startYear = new Date(startDate).getFullYear();
    for (let i = 0; i < tenorYears; i++) {
      const obsYear = startYear + i;
      // Random month (0-11) and day (1-28 to be safe)
      const randomMonth = Math.floor(Math.random() * 12);
      const randomDay = Math.floor(Math.random() * 28) + 1;
      const obsDate = new Date(obsYear, randomMonth, randomDay);
      
      observations.push({
        date: obsDate.toISOString().split('T')[0],
        hurdle_percent: Math.floor(Math.random() * 30) + 80, // 80-110%
        triggered: Math.random() > 0.7
      });
    }

    setData({
      ...data,
      plan_name: planNames[Math.floor(Math.random() * planNames.length)],
      tenor_years: tenorYears,
      start_date: startDate,
      current_date: currentDate,
      initial_strike_level: initialStrike,
      current_level: currentLevel,
      barrier_percent: Math.floor(Math.random() * 101) - 50, // -50 to +50 (same range as A pointer)
      observations: observations,
      bottom_arrow_color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      bottom_arrow_target: Math.floor(Math.random() * 360), // 0-360 degrees on circle
      circle_fill: `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`,
      counterparty: counterparties[Math.floor(Math.random() * counterparties.length)],
      is_called: Math.random() > 0.8,
      called_date: Math.random() > 0.8 ? currentDate : null
    });
  };

  const toggleCalled = () => {
    setData(prev => ({
      ...prev,
      is_called: !prev.is_called,
      called_date: !prev.is_called ? prev.current_date : null
    }));
  };

  const performance = ((data.current_level - data.initial_strike_level) / data.initial_strike_level * 100).toFixed(2);

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '14px',
    color: '#333'
  };

  const sectionStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '600px'
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'row', 
      alignItems: 'flex-start',
      padding: '20px',
      gap: '20px',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Left side: Logo */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <h1 style={{ 
          color: '#0A255A', 
          fontFamily: 'Inter, Segoe UI, sans-serif',
          marginBottom: '10px',
          width: '100%',
          textAlign: 'center'
        }}>
          Autocalls.uk Dynamic Logo
        </h1>
        {/* Circle fill color picker - bound to data.circle_fill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '10px',
          background: '#f8fafc',
          padding: '10px 18px',
          borderRadius: '10px',
          boxShadow: '0 1px 4px #0001',
        }}>
          <label htmlFor="circle-fill-picker" style={{ fontWeight: 500, fontSize: 15, color: '#0b3763' }}>
            Circle Fill Color:
          </label>
          <input
            id="circle-fill-picker"
            type="color"
            value={data.circle_fill || '#FFFFFF'}
            onChange={e => updateField('circle_fill', e.target.value)}
            style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', boxShadow: '0 1px 4px #0002', borderRadius: 8 }}
          />
        </div>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <DynamicLogo data={data} animate={animate} size={size} debug={debug} />
        </div>
      </div>

      {/* Right side: Controls */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxHeight: '100vh',
        overflowY: 'auto'
      }}>
        {/* Randomize Button */}
        <button
          onClick={randomizeAll}
          style={{
            padding: '15px 40px',
            backgroundColor: '#5E35B1',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: '0 4px 15px rgba(94,53,177,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            width: '100%'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'scale(1.05)';
            e.target.style.boxShadow = '0 6px 20px rgba(94,53,177,0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 15px rgba(94,53,177,0.3)';
          }}
        >
          Randomize All
        </button>

      {/* Display Controls */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Display Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={animate}
              onChange={(e) => setAnimate(e.target.checked)}
            />
            Enable Animation
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
            />
            Debug Mode
          </label>
          <label style={labelStyle}>
            Size
            <select value={size} onChange={(e) => setSize(parseInt(e.target.value))} style={inputStyle}>
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={768}>768px</option>
              <option value={1024}>1024px</option>
            </select>
          </label>
        </div>
      </div>

      {/* Basic Info */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Basic Info</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <label style={labelStyle}>
            Plan Name
            <input
              type="text"
              value={data.plan_name}
              onChange={(e) => updateField('plan_name', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Counterparty
            <input
              type="text"
              value={data.counterparty}
              onChange={(e) => updateField('counterparty', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Tenor (Years)
            <input
              type="number"
              min={1}
              max={15}
              value={data.tenor_years}
              onChange={(e) => updateField('tenor_years', parseInt(e.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
          <label style={labelStyle}>
            Bottom Arrow Color
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={data.bottom_arrow_color || '#107b44'}
                onChange={(e) => updateField('bottom_arrow_color', e.target.value)}
                style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={data.bottom_arrow_color || '#107b44'}
                onChange={(e) => updateField('bottom_arrow_color', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </label>
          <label style={labelStyle}>
            Bottom Arrow Target (0-360°)
            <input
              type="number"
              min={0}
              max={360}
              step={1}
              value={data.bottom_arrow_target ?? 0}
              onChange={(e) => updateField('bottom_arrow_target', parseFloat(e.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>
            Bottom Arrow Target Slider ({data.bottom_arrow_target ?? 0}°) — points at this angle on circle (0°=12:00, 90°=3:00, 180°=6:00, 270°=9:00)
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={data.bottom_arrow_target ?? 0}
              onChange={(e) => updateField('bottom_arrow_target', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </div>

      {/* Dates */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Dates</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <label style={labelStyle}>
            Start Date
            <input
              type="date"
              value={data.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Current Date
            <input
              type="date"
              value={data.current_date}
              min={data.start_date}
              onChange={(e) => updateField('current_date', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Market Close Time (GMT)
            <input
              type="time"
              value={data.market_close_time_gmt}
              onChange={(e) => updateField('market_close_time_gmt', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Called Date
            <input
              type="date"
              value={data.called_date || ''}
              onChange={(e) => updateField('called_date', e.target.value || null)}
              style={inputStyle}
            />
          </label>
        </div>
      </div>

      {/* Levels */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Levels & Performance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <label style={labelStyle}>
            Initial Strike Level (Index)
            <input
              type="number"
              min={1000}
              max={20000}
              value={data.initial_strike_level}
              onChange={(e) => updateField('initial_strike_level', parseFloat(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Current Level (Index)
            <input
              type="number"
              min={1000}
              max={20000}
              value={data.current_level}
              onChange={(e) => updateField('current_level', parseFloat(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Barrier Percent (-50% to +50%)
            <input
              type="number"
              min={-50}
              max={50}
              value={data.barrier_percent}
              onChange={(e) => updateField('barrier_percent', parseInt(e.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
        
        {/* Current Level Slider */}
        <label style={{ ...labelStyle, marginTop: '15px' }}>
          Current Level Slider ({performance}% performance)
          <input
            type="range"
            min={Math.floor(data.initial_strike_level * 0.5)}
            max={Math.floor(data.initial_strike_level * 1.5)}
            step={10}
            value={data.current_level}
            onChange={(e) => updateField('current_level', parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
      </div>

      {/* Called Status */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Status</h3>
        <button
          onClick={toggleCalled}
          style={{
            padding: '12px 24px',
            backgroundColor: data.is_called ? '#C62828' : '#007A3A',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {data.is_called ? '✓ Called - Click to Mark Active' : '○ Active - Click to Mark as Called'}
        </button>
      </div>

      {/* Observations */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Observations ({data.observations.length})</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {data.observations.map((obs, i) => (
            <div key={i} style={{ 
              display: 'grid', 
              gridTemplateColumns: '30px 1fr 80px 80px', 
              gap: '10px', 
              alignItems: 'center',
              padding: '8px',
              backgroundColor: obs.triggered ? '#e8f5e9' : '#fff',
              borderRadius: '6px',
              marginBottom: '8px',
              border: '1px solid #eee'
            }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>#{i + 1}</span>
              <input
                type="date"
                value={obs.date}
                onChange={(e) => updateObservation(i, 'date', e.target.value)}
                style={{ ...inputStyle, padding: '6px 8px' }}
              />
              <input
                type="number"
                value={obs.hurdle_percent}
                onChange={(e) => updateObservation(i, 'hurdle_percent', e.target.value)}
                style={{ ...inputStyle, padding: '6px 8px' }}
                placeholder="%"
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={obs.triggered}
                  onChange={(e) => updateObservation(i, 'triggered', e.target.checked)}
                />
                Triggered
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Brand Colours */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Brand Colours</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
          {Object.entries(data.brand_colours).map(([key, value]) => (
            <label key={key} style={labelStyle}>
              {key.replace(/_/g, ' ')}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => updateBrandColour(key, e.target.value)}
                  style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateBrandColour(key, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Design Tokens */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', margin: '0 0 15px 0' }}>Design Tokens</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <label style={labelStyle}>
            Gap Angle (deg)
            <input
              type="number"
              step="0.5"
              value={data.design_tokens.gap_angle_deg}
              onChange={(e) => updateDesignToken('gap_angle_deg', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Tick Stroke Width
            <input
              type="number"
              step="0.5"
              value={data.design_tokens.tick_stroke_width}
              onChange={(e) => updateDesignToken('tick_stroke_width', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Segment Outline Width
            <input
              type="number"
              step="0.5"
              value={data.design_tokens.segment_outline_width}
              onChange={(e) => updateDesignToken('segment_outline_width', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Radial Offset (px)
            <input
              type="number"
              value={data.design_tokens.radial_offset_px}
              onChange={(e) => updateDesignToken('radial_offset_px', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Angular Jitter (deg)
            <input
              type="number"
              step="0.5"
              value={data.design_tokens.angular_jitter_deg}
              onChange={(e) => updateDesignToken('angular_jitter_deg', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Pointer Ease
            <select
              value={data.design_tokens.pointer_ease}
              onChange={(e) => updateDesignToken('pointer_ease', e.target.value)}
              style={inputStyle}
            >
              <option value="easeOutQuad">easeOutQuad</option>
              <option value="easeInQuad">easeInQuad</option>
              <option value="easeInOutQuad">easeInOutQuad</option>
              <option value="linear">linear</option>
            </select>
          </label>
        </div>
      </div>

      {/* JSON Display */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#0A255A', marginTop: 0 }}>Current JSON Data</h3>
        <pre style={{ 
          fontSize: '11px', 
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          padding: '10px',
          borderRadius: '8px',
          maxHeight: '300px'
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
      </div>
    </div>
  );
}

export default App;
