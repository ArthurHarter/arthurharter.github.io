document.addEventListener('DOMContentLoaded',()=>{
 const cfg=window.GUIA_CONFIG||{}; const table=[...document.querySelectorAll('table')].find(t=>/Custo aprox\.\/mês/.test(t.textContent)); if(!table)return;
 const tariff=Number(cfg.tarifaKWh)||0; const fmt=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const note=document.createElement('div'); note.className='table-note';note.style.cssText='margin:14px 0;font-size:13px';
 const lbl=document.createElement('label');lbl.textContent='Tarifa de referência (R$/kWh): '; const input=document.createElement('input');input.type='number';input.min='0.01';input.step='0.00001';input.value=tariff||'';input.style.cssText='max-width:125px;padding:7px;background:transparent;color:inherit;border:1px solid #888;border-radius:6px';lbl.appendChild(input);note.appendChild(lbl);
 const explain=document.createElement('p');explain.textContent='Referência de 2026: '+(cfg.tarifaFonte||'ANEEL')+'. Não é o valor final da conta. Última revisão: '+cfg.atualizadoEm+'. ';const link=document.createElement('a');link.href=cfg.tarifaUrl;link.textContent='Fonte oficial ANEEL';link.target='_blank';link.rel='noopener noreferrer';explain.appendChild(link);note.appendChild(explain);table.insertAdjacentElement('afterend',note);
 function update(){const rate=Number(input.value);for(const row of table.querySelectorAll('tbody tr')){const c=row.querySelectorAll('td');if(c.length<6)continue;const raw=c[3].textContent.trim();const m=raw.match(/^([\d.,]+)\s*kWh/i);if(!m){c[4].textContent='Conforme etiqueta';continue;}const kwh=Number(m[1].replace(',','.'));c[4].textContent=rate>0?'R$ '+fmt(kwh*rate):'Informe sua tarifa';}}
 input.addEventListener('input',update);update();
});
