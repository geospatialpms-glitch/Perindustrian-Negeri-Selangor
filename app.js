const COLORS = ['#d71920','#f04a23','#f58220','#f9a61a','#fbc02d','#7e57c2','#29b6f6','#8d9398','#43a047','#5c6bc0'];
let allFeatures = [], filteredFeatures = [], geoLayer;
let districtChart, categoryChart, areaChart, pbtChart, mipChart;

const map = L.map('map', { zoomControl: true }).setView([3.25,101.45], 9);
const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Tiles &copy; Esri'});
street.addTo(map);
L.control.layers({'Peta': street, 'Satelit': satellite}, null, {position:'topleft'}).addTo(map);

const categoryColor = {};
function colorForCategory(cat){
  if(!categoryColor[cat]) categoryColor[cat] = COLORS[Object.keys(categoryColor).length % COLORS.length];
  return categoryColor[cat];
}

fetch('data/perindustrian_selangor.geojson')
  .then(r => r.json())
  .then(data => {
    allFeatures = data.features;
    populateFilters();
    createCharts();
    applyFilters();
    addLegend();
  })
  .catch(err => {
    console.error(err);
    alert('Data GeoJSON tidak dapat dimuatkan. Jalankan dashboard melalui web server / GitHub Pages, bukan terus file://.');
  });

function unique(field){return [...new Set(allFeatures.map(f=>f.properties[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)))}
function fillSelect(id, values){const el=document.getElementById(id); values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});}
function populateFilters(){fillSelect('filterDaerah',unique('DAERAH'));fillSelect('filterPBT',unique('PBT'));fillSelect('filterKategori',unique('KATEGORI'));}

['filterDaerah','filterPBT','filterKategori','filterMIP'].forEach(id=>document.getElementById(id).addEventListener('change',applyFilters));
document.getElementById('searchBox').addEventListener('input',renderTable);
document.getElementById('resetBtn').addEventListener('click',()=>{['filterDaerah','filterPBT','filterKategori','filterMIP'].forEach(id=>document.getElementById(id).value='');document.getElementById('searchBox').value='';applyFilters();});

document.querySelectorAll('.menu-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.menu-item').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}));

function applyFilters(){
  const d=document.getElementById('filterDaerah').value,p=document.getElementById('filterPBT').value,c=document.getElementById('filterKategori').value,m=document.getElementById('filterMIP').value;
  filteredFeatures=allFeatures.filter(f=>(!d||f.properties.DAERAH===d)&&(!p||f.properties.PBT===p)&&(!c||f.properties.KATEGORI===c)&&(!m||f.properties.MIP===m));
  updateKPIs(); updateMap(); updateCharts(); renderTable();
}
function updateKPIs(){
  document.getElementById('kpiTotal').textContent=filteredFeatures.length.toLocaleString('ms-MY');
  document.getElementById('kpiPbt').textContent=new Set(filteredFeatures.map(f=>f.properties.PBT).filter(Boolean)).size;
  document.getElementById('kpiKategori').textContent=new Set(filteredFeatures.map(f=>f.properties.KATEGORI).filter(Boolean)).size;
  document.getElementById('kpiMip').textContent=filteredFeatures.filter(f=>f.properties.MIP==='Yes').length;
  document.getElementById('mapCount').textContent=`${filteredFeatures.length} kawasan`;
}
function updateMap(){
  if(geoLayer) map.removeLayer(geoLayer);
  geoLayer=L.geoJSON({type:'FeatureCollection',features:filteredFeatures},{
    style:f=>({color:'#ffffff',weight:.8,fillColor:colorForCategory(f.properties.KATEGORI||'Lain-lain'),fillOpacity:.78}),
    onEachFeature:(f,l)=>{const p=f.properties;l.bindPopup(`<div class="popup-title">${p.NAMA||'Kawasan Perindustrian'}</div><b>Daerah:</b> ${p.DAERAH||'-'}<br><b>PBT:</b> ${p.PBT||'-'}<br><b>Kategori:</b> ${p.KATEGORI||'-'}<br><b>MIP:</b> ${p.MIP==='Yes'?'Ya':'Tidak'}<br><b>Keluasan:</b> ${Number(p.AREA_HA||0).toLocaleString('ms-MY',{maximumFractionDigits:2})} ha<br><b>Alamat:</b> ${p.ALAMAT||'-'}`);}
  }).addTo(map);
  if(filteredFeatures.length){const b=geoLayer.getBounds();if(b.isValid())map.fitBounds(b,{padding:[18,18],maxZoom:12});}
}
function aggregate(field, metric='count'){
  const out={};filteredFeatures.forEach(f=>{const k=f.properties[field]||'Tiada Maklumat';if(metric==='area')out[k]=(out[k]||0)+Number(f.properties.AREA_HA||0);else out[k]=(out[k]||0)+1;});return out;
}
function sortedEntries(obj,desc=true){return Object.entries(obj).sort((a,b)=>desc?b[1]-a[1]:a[1]-b[1]);}
function createCharts(){
  Chart.defaults.font.family='Inter'; Chart.defaults.color='#475569';
  districtChart=new Chart(document.getElementById('districtChart'),{type:'bar',data:{labels:[],datasets:[{data:[],backgroundColor:COLORS,borderRadius:3}]},options:barHorizontalOptions()});
  categoryChart=new Chart(document.getElementById('categoryChart'),{type:'doughnut',data:{labels:[],datasets:[{data:[],backgroundColor:COLORS,borderWidth:1,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:10}}}}}});
  areaChart=new Chart(document.getElementById('areaChart'),{type:'bar',data:{labels:[],datasets:[{data:[],backgroundColor:COLORS,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'Hektar'},grid:{color:'#edf1f5'}},x:{grid:{display:false},ticks:{font:{size:9}}}}}});
  pbtChart=new Chart(document.getElementById('pbtChart'),{type:'bar',data:{labels:[],datasets:[{data:[],backgroundColor:COLORS,borderRadius:3}]},options:barHorizontalOptions()});
  mipChart=new Chart(document.getElementById('mipChart'),{type:'doughnut',data:{labels:['MIP','Bukan MIP'],datasets:[{data:[0,0],backgroundColor:['#d71920','#f7b733'],borderColor:'#fff',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:10}}}}}});
}
function barHorizontalOptions(){return{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#edf1f5'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}}
function updateCharts(){
  let e=sortedEntries(aggregate('DAERAH')); districtChart.data.labels=e.map(x=>x[0]);districtChart.data.datasets[0].data=e.map(x=>x[1]);districtChart.update();
  e=sortedEntries(aggregate('KATEGORI')); categoryChart.data.labels=e.map(x=>x[0]);categoryChart.data.datasets[0].data=e.map(x=>x[1]);categoryChart.data.datasets[0].backgroundColor=e.map(x=>colorForCategory(x[0]));categoryChart.update();
  e=sortedEntries(aggregate('DAERAH','area'));areaChart.data.labels=e.map(x=>x[0]);areaChart.data.datasets[0].data=e.map(x=>Number(x[1].toFixed(2)));areaChart.update();
  e=sortedEntries(aggregate('PBT')).slice(0,8);pbtChart.data.labels=e.map(x=>x[0]);pbtChart.data.datasets[0].data=e.map(x=>x[1]);pbtChart.update();
  const yes=filteredFeatures.filter(f=>f.properties.MIP==='Yes').length,no=filteredFeatures.filter(f=>f.properties.MIP!=='Yes').length;mipChart.data.datasets[0].data=[yes,no];mipChart.update();
}
function renderTable(){
  const q=(document.getElementById('searchBox').value||'').toLowerCase();
  const rows=filteredFeatures.filter(f=>{const p=f.properties;return !q||[p.NAMA,p.LOKASI,p.ALAMAT,p.DAERAH,p.PBT,p.KATEGORI].some(v=>String(v||'').toLowerCase().includes(q));}).slice(0,300);
  document.getElementById('dataTableBody').innerHTML=rows.map(f=>{const p=f.properties;return `<tr><td><b>${p.NAMA||'-'}</b></td><td>${p.DAERAH||'-'}</td><td>${p.PBT||'-'}</td><td>${p.KATEGORI||'-'}</td><td><span class="badge ${p.MIP==='Yes'?'yes':'no'}">${p.MIP==='Yes'?'Ya':'Tidak'}</span></td><td>${Number(p.AREA_HA||0).toLocaleString('ms-MY',{maximumFractionDigits:2})}</td></tr>`}).join('');
}
function addLegend(){
  const legend=L.control({position:'topright'});legend.onAdd=()=>{const div=L.DomUtil.create('div','legend');div.innerHTML='<b>Kategori Kawasan</b><br>'+unique('KATEGORI').map(c=>`<i style="background:${colorForCategory(c)}"></i>${c}`).join('<br>');return div;};legend.addTo(map);
}
