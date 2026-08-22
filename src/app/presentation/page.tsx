'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    // Slide 1: Cover
    {
      title: "DIMAH AL RAEDAH SPC PMS",
      subtitle: "Oman-Compliant Construction Project Management System",
      description: "A comprehensive digital solution integrating Bill of Quantities (BOQ), Procurement, Site Inventory, Tax Compliance, and Revenue Claims.",
      type: "cover",
    },
    // Slide 2: Executive Summary
    {
      title: "Executive Summary",
      subtitle: "Bridging the Gap in Construction Operations",
      type: "split",
      left: {
        title: "Operations Challenge",
        items: [
          "Disconnected spreadsheets leading to budget overruns.",
          "Difficulty tracking material delivery note histories.",
          "High wastage and leakage on job sites.",
          "Complex VAT calculations for milestone billing."
        ]
      },
      right: {
        title: "The PMS Solution",
        items: [
          "Unified data lifecycle from estimate to execution.",
          "Strict budgetary controls at the PO line-item level.",
          "Real-time site issue and consumption auditing.",
          "Automated VAT ledger and compliance reporting."
        ]
      }
    },
    // Slide 3: Workflow
    {
      title: "Operational Workflow Lifecycle",
      subtitle: "From Estimation to Stock Ledger Verification",
      type: "workflow",
      steps: [
        { num: "01", label: "BOQ Setup", desc: "Define planned quantities & unit rates." },
        { num: "02", label: "Purchase Order", desc: "Issue POs mapped directly to BOQ codes." },
        { num: "03", label: "Goods Receipt (GRN)", desc: "Acknowledge physical materials on site." },
        { num: "04", label: "Issue & Consume", desc: "Track consumption & wastage at locations." },
        { num: "05", label: "Stock Ledger", desc: "Automated calculations of site balance." }
      ]
    },
    // Slide 4: Oman Compliance
    {
      title: "Oman Regulatory Compliance",
      subtitle: "Custom-Tailored for Local Business Standards",
      type: "compliance",
      cards: [
        { title: "Standard 5% VAT", desc: "Automated standard 5% tax configuration on all Purchase Orders, GRNs, and Claims." },
        { title: "Rial Omani (OMR)", desc: "Full financial calculations supporting standard Omani 3-decimal place precision (e.g., OMR 1,450.750)." },
        { title: "CR & VAT Numbers", desc: "Centralized tracking of Commercial Registration (CR) and VAT numbers for contractors and suppliers." }
      ]
    },
    // Slide 5: Dual BOQ & Mapping
    {
      title: "Dual BOQ & Claim Management",
      subtitle: "Connecting Cost Centers to Revenue Milestones",
      type: "mapping",
      left: {
        title: "Cost (Internal BOQ)",
        desc: "Granular material costs, equipment, and subcontractor rates on the jobsite."
      },
      right: {
        title: "Revenue (Client BOQ)",
        desc: "High-level contracted milestones, client billing structures, and claims."
      },
      linkText: "Weight-Based Allocation & Progress Linking"
    },
    // Slide 6: Role Access Control
    {
      title: "Role-Based Access Control",
      subtitle: "Secure Separation of Duties Matrix",
      type: "rbac",
      roles: [
        { name: "Admin", access: ["Master Dashboard", "Projects Setup", "BOQ & Estimating", "Procurement Approval", "Site Logistics & GRN", "Settings & Users"] },
        { name: "Purchase", access: ["Supplier Directory", "Purchase Order Issuance", "View Projects & BOQ", "View Reporting Modules"] },
        { name: "Site Engineer", access: ["Goods Receipt Notes (GRN)", "Material Consumption Issues", "View Project Stock Balances"] }
      ]
    },
    // Slide 7: Audit Trails
    {
      title: "Auditing & Accountability",
      subtitle: "Comprehensive System Activity Log & Rollbacks",
      type: "audit",
      items: [
        { label: "Change Logs", desc: "Every transaction records a structured JSON summary of fields changed." },
        { label: "Environment & Context", desc: "Tracks environment (dev, staging, prod), user ID, and username." },
        { label: "Verification & Verification Diffs", desc: "Records screenshots before and after, rollback guidelines, and support ticket numbers." }
      ]
    },
    // Slide 8: Tasks & Kanban Module
    {
      title: "Task Management & Kanban Board",
      subtitle: "New: Agile Workflow Coordination",
      type: "tasks",
      features: [
        { title: "Kanban Visual Workspace", desc: "Drag-and-drop workflow status boards categorizing tasks under To Do, In Progress, Review, and Completed." },
        { title: "BOQ Line Item Mapping", desc: "Map project tasks directly to BOQ codes to visualize budgeting constraints and physical delivery side-by-side." },
        { title: "Dashboard Overview Integration", desc: "Main dashboard features a live Kanban widget to keep teams updated on pending work instantly." }
      ]
    },
    // Slide 9: Operating Manual Guide
    {
      title: "Operating Manual & Guided Steps",
      subtitle: "Quick Start Operations Cycle Cheat Sheet",
      type: "manual",
      manualSteps: [
        { step: "1. Baselines", desc: "Setup project details and define Internal & Client BOQ estimation targets." },
        { step: "2. Procurement", desc: "Issue Purchase Orders mapped to BOQs. Standard 5% Oman VAT is calculated automatically." },
        { step: "3. Site Receipt & Issue", desc: "Generate Goods Receipt Notes (GRN) to register stock, then Material Issue Notes to consume." },
        { step: "4. Daily Execution Tasks", desc: "Monitor daily progress by updating tasks, tracking work hours, and claiming progress milestones." }
      ]
    }
  ];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const slide = slides[currentSlide];

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc',
      fontFamily: 'var(--font-family)',
      padding: '2.5rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.08)',
      transition: 'all 0.4s ease',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient light effects */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.15) 0%, transparent 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%',
        background: 'radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, transparent 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, #0284c7, #0d9488)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '1rem', color: '#fff'
          }}>
            D
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', letterSpacing: '1px', color: '#94a3b8' }}>
            DIMAH AL RAEDAH PMS
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a 
            href="/DIMAH_AL_RAEDAH_PMS_Presentation.pptx" 
            download 
            style={{
              textDecoration: 'none', color: '#fbbf24', background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px',
              padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: '600',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem'
            }} 
            onMouseOver={e => e.currentTarget.style.background = 'rgba(251,191,36,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(251,191,36,0.1)'}
          >
            📥 Download PowerPoint
          </a>
          <Link href="/" style={{
            textDecoration: 'none', color: '#f8fafc', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
            padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: '600',
            transition: 'all 0.2s'
          }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
             onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
            Go to Dashboard →
          </Link>
        </div>
      </div>

      {/* Slide Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '2rem 0', zIndex: 10 }}>
        {/* Cover Type */}
        {slide.type === 'cover' && (
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{
              fontSize: '3.5rem', fontWeight: '800', lineHeight: '1.1',
              background: 'linear-gradient(to right, #38bdf8, #2dd4bf)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: '1rem', animation: 'fadeIn 1s'
            }}>
              {slide.title}
            </h1>
            <h3 style={{ fontSize: '1.5rem', color: '#94a3b8', fontWeight: '500', marginBottom: '2rem' }}>
              {slide.subtitle}
            </h3>
            <p style={{ fontSize: '1.1rem', color: '#64748b', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
              {slide.description}
            </p>
          </div>
        )}

        {/* Split Info Type */}
        {slide.type === 'split' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '1.5rem' }}>
                <h4 style={{ color: '#f87171', fontSize: '1.15rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚠️ {slide.left?.title}
                </h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingLeft: '1.2rem', color: '#cbd5e1' }}>
                  {slide.left?.items?.map((item: any, idx: number) => <li key={idx}>{item}</li>)}
                </ul>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '1.5rem' }}>
                <h4 style={{ color: '#34d399', fontSize: '1.15rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✅ {slide.right?.title}
                </h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingLeft: '1.2rem', color: '#cbd5e1' }}>
                  {slide.right?.items?.map((item: any, idx: number) => <li key={idx}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Type */}
        {slide.type === 'workflow' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2.5rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: '1rem', position: 'relative' }}>
              {slide.steps?.map((step, idx) => (
                <div key={idx} style={{
                  flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '1.2rem', display: 'flex', flexDirection: 'column',
                  gap: '0.5rem', position: 'relative', transition: 'transform 0.2s'
                }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                   onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{
                    fontSize: '2rem', fontWeight: '800',
                    background: 'linear-gradient(135deg, #38bdf8, #0d9488)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    lineHeight: '1'
                  }}>
                    {step.num}
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>{step.label}</h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance Type */}
        {slide.type === 'compliance' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              {slide.cards?.map((card, idx) => (
                <div key={idx} style={{
                  background: 'rgba(2, 132, 199, 0.04)', border: '1px solid rgba(2, 132, 199, 0.15)',
                  borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                }}>
                  <div style={{ fontSize: '1.8rem' }}>🇴🇲</div>
                  <h4 style={{ color: '#38bdf8', fontSize: '1.2rem', fontWeight: '700' }}>{card.title}</h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5' }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mapping Type */}
        {slide.type === 'mapping' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
              <div style={{
                flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', padding: '2rem', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#2dd4bf', marginBottom: '0.5rem' }}>{slide.left?.title}</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>{slide.left?.desc}</p>
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '150px'
              }}>
                <div style={{ fontSize: '2rem' }}>🔄</div>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '600', textAlign: 'center' }}>
                  {slide.linkText}
                </span>
              </div>

              <div style={{
                flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', padding: '2rem', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💰</div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#38bdf8', marginBottom: '0.5rem' }}>{slide.right?.title}</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>{slide.right?.desc}</p>
              </div>
            </div>
          </div>
        )}

        {/* RBAC Type */}
        {slide.type === 'rbac' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              {slide.roles?.map((role, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '1.5rem'
                }}>
                  <h4 style={{
                    color: role.name === 'Admin' ? '#fbbf24' : role.name === 'Purchase' ? '#38bdf8' : '#34d399',
                    fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: '0.5rem'
                  }}>
                    {role.name}
                  </h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '1rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {role.access.map((item, id) => <li key={id}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Logs Type */}
        {slide.type === 'audit' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              {slide.items?.map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '1.5rem'
                }}>
                  <h4 style={{ color: '#38bdf8', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    {item.label}
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5' }}>{item.desc}</p>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: '1.5rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px', padding: '1rem', fontSize: '0.8rem', fontFamily: 'monospace', color: '#2dd4bf'
            }}>
              {`{ "change_summary": "Updated PO qty", "user": "admin", "env": "prod", "diff": { "qty": [10.0, 15.0] } }`}
            </div>
          </div>
        )}

        {/* Tasks Type */}
        {slide.type === 'tasks' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '2rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              {slide.features?.map((feat: any, idx: number) => (
                <div key={idx} style={{
                  background: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.15)',
                  borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                }}>
                  <div style={{ fontSize: '1.8rem' }}>📋</div>
                  <h4 style={{ color: '#38bdf8', fontSize: '1.15rem', fontWeight: '700' }}>{feat.title}</h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5' }}>{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Type */}
        {slide.type === 'manual' && (
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {slide.subtitle}
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '1.5rem', color: '#f8fafc' }}>
              {slide.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {slide.manualSteps?.map((step: any, idx: number) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '1.2rem'
                }}>
                  <h4 style={{ color: '#2dd4bf', fontSize: '1rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                    {step.step}
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.4' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', zIndex: 10
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: currentSlide === idx ? '#38bdf8' : 'rgba(255,255,255,0.2)',
                border: 'none', cursor: 'pointer', transition: 'background 0.3s'
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Slide {currentSlide + 1} of {slides.length}
          </span>
          <button
            onClick={handlePrev}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', width: '36px', height: '36px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            ←
          </button>
          <button
            onClick={handleNext}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', width: '36px', height: '36px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
