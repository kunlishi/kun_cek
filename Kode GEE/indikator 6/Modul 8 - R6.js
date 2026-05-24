// =====================================================
// [1] BOUNDARY WILAYAH (AOI) - ACEH, SUMUT, SUMBAR
// =====================================================
var datasetBatas = ee.FeatureCollection("FAO/GAUL/2015/level2"); 

// Memanggil 3 provinsi sekaligus menggunakan inList
var aoi = datasetBatas.filter(ee.Filter.inList('ADM1_NAME', [
  'Nangroe Aceh Darussalam', 
  'Sumatera Utara', 
  'Sumatera Barat'
]));

Map.centerObject(aoi, 6); 

var batasOutline = ee.Image().paint({featureCollection: aoi, color: 1, width: 1});
Map.addLayer(batasOutline, {palette: ['black']}, '1. Batas 3 Provinsi');

// =====================================================
// [2] PENGAMBILAN DATA CURRENT (BENCANA VS RECOVERY)
// =====================================================
var smap = ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").select('sm_rootzone');

// Menggunakan variabel 'aoi' untuk 3 provinsi di bulan Desember
var dataBencana = smap.filterBounds(aoi).filterDate('2025-12-01', '2025-12-31').mean().clip(aoi);
var dataRecovery = smap.filterBounds(aoi).filterDate('2026-04-01', '2026-04-30').mean().clip(aoi);

// =====================================================
// [3] HISTORIS BASELINE (NORMAL)
// =====================================================
// Baseline Historis Desember (2018-2019)
var histDes = smap.filterBounds(aoi)
                  .filter(ee.Filter.calendarRange(2018, 2019, 'year'))
                  .filter(ee.Filter.calendarRange(12, 12, 'month'));
var meanDes = histDes.mean().clip(aoi);
var sdDes = histDes.reduce(ee.Reducer.stdDev()).clip(aoi);

// Baseline Historis April (2020-2025)
var histApr = smap.filterBounds(aoi)
                  .filter(ee.Filter.calendarRange(2020, 2025, 'year'))
                  .filter(ee.Filter.calendarRange(4, 4, 'month'));
var meanApr = histApr.mean().clip(aoi);
var sdApr = histApr.reduce(ee.Reducer.stdDev()).clip(aoi);

// =====================================================
// [4] HITUNG Z-SCORE & THRESHOLDING
// =====================================================
var zBencana = dataBencana.subtract(meanDes).divide(sdDes);
var zRecovery = dataRecovery.subtract(meanApr).divide(sdApr);

var thresholdZ = 1.5; 
var kritisBencana = zBencana.gt(thresholdZ).selfMask();
var kritisRecovery = zRecovery.gt(thresholdZ).selfMask();

// =====================================================
// [5] SLOPE MASKING (RISIKO LONGSOR > 15 DERAJAT)
// =====================================================
var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);

var longsorBencana = kritisBencana.updateMask(slope.gt(15));
var longsorRecovery = kritisRecovery.updateMask(slope.gt(15));

// =====================================================
// [6] VISUALISASI KE PETA (ATUR DI MENU LAYERS)
// =====================================================
var zVis = {min: -3, max: 3, palette: ['red', 'white', 'blue']}; 

// Tampilan Desember 2025 (Saat Bencana)
Map.addLayer(zBencana, zVis, '2. Z-Score (Desember 2025)', false);
Map.addLayer(kritisBencana, {palette: ['#FF0000']}, '3. Area Jenuh (Desember 2025)', false);
Map.addLayer(longsorBencana, {palette: ['#00FFFF']}, '4. Risiko Longsor (Des)', false);

// Tampilan April 2026 (Fase Pemulihan) 
Map.addLayer(zRecovery, zVis, '5. Z-Score (April 2026)', false);
Map.addLayer(kritisRecovery, {palette: ['#FF0000']}, '6. Sisa Area Jenuh (April 2026)', false);
Map.addLayer(longsorRecovery, {palette: ['#00FFFF']}, '7. Sisa Risiko Longsor (Apr)', false);

// =====================================================
// [7] EXPORT DATA TABULAR (CSV) KE GOOGLE DRIVE
// =====================================================

// Proses 'Zonal Statistics': Menghitung rata-rata Z-Score per Kabupaten/Kota
var dataTabelDesember = zBencana.reduceRegions({
  collection: aoi, // Memakai jaring batas FAO GAUL Level 2 (Kabupaten/Kota)
  reducer: ee.Reducer.mean(), // Menghitung nilai rata-rata (mean)
  scale: 1000 // Skala resolusi (dalam meter) untuk sampling
});

// Mengekspor FeatureCollection (Tabel) ke Google Drive
Export.table.toDrive({
  collection: dataTabelDesember,
  description: 'Tabel_ZScore_Bencana_Des2025', // Nama file di Drive
  folder: 'GEE_Banjir_Sumatera', // Nama folder di Drive
  fileFormat: 'CSV' // Dikeluarkan sebagai file Comma Separated Values (Excel/Tabel)
});