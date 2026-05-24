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

var dataBencana = smap.filterBounds(aoi).filterDate('2025-11-01', '2025-12-31').mean();
var dataRecovery = smap.filterBounds(aoi).filterDate('2026-01-01', '2026-05-22').mean();

// =====================================================
// [3] HISTORIS BASELINE (NORMAL)
// =====================================================
// Baseline Historis Bencana (2018-2019)
var histBencana = smap.filterBounds(aoi)
                  .filter(ee.Filter.calendarRange(2018, 2019, 'year'))
                  .filter(ee.Filter.calendarRange(11, 12, 'month'));
var meanBencana = histBencana.mean();
var sdBencana = histBencana.reduce(ee.Reducer.stdDev()); 

// Baseline Historis Recovery
var histRecovery = smap.filterBounds(aoi)
                  .filter(ee.Filter.calendarRange(2024, 2024, 'year')) 
                  .filter(ee.Filter.calendarRange(1, 5, 'month'));
var meanRecovery = histRecovery.mean(); 
var sdRecovery = histRecovery.reduce(ee.Reducer.stdDev());
var meanRecovery = histRecovery.mean(); 
var sdRecovery = histRecovery.reduce(ee.Reducer.stdDev());

// =====================================================
// [4] HITUNG Z-SCORE & THRESHOLDING 
// =====================================================
var zBencana = dataBencana.subtract(meanBencana).divide(sdBencana).clip(aoi);
var zRecovery = dataRecovery.subtract(meanRecovery).divide(sdRecovery).clip(aoi);

var thresholdZ = 1.5; 
var kritisBencana = zBencana.gt(thresholdZ).selfMask();
var kritisRecovery = zRecovery.gt(thresholdZ).selfMask();

// =====================================================
// [5] SLOPE MASKING (RISIKO LONGSOR > 15 DERAJAT)
// =====================================================
// Menggunakan DEM 90m yang lebih ramah memori untuk skala 3 provinsi
var dem = ee.Image('CGIAR/SRTM90_V4');
var slope = ee.Terrain.slope(dem);

var longsorBencana = kritisBencana.updateMask(slope.gt(15));
var longsorRecovery = kritisRecovery.updateMask(slope.gt(15));

// =====================================================
// [6] VISUALISASI KE PETA (ATUR DI MENU LAYERS)
// =====================================================
var zVis = {min: -3, max: 3, palette: ['red', 'white', 'blue']}; 

// Tampilan Bencana 2025 (Saat Bencana)
Map.addLayer(zBencana, zVis, '2. Z-Score (Bencana 2025)', false);
Map.addLayer(kritisBencana, {palette: ['#FF0000']}, '3. Area Jenuh (Bencana 2025)', false);
Map.addLayer(longsorBencana, {palette: ['#00FFFF']}, '4. Risiko Longsor (Bencana)', false);

// Tampilan Recovery 2026 (Fase Pemulihan) 
Map.addLayer(zRecovery, zVis, '5. Z-Score (Recovery 2026)', false);
Map.addLayer(kritisRecovery, {palette: ['#FF0000']}, '6. Sisa Area Jenuh (Recovery 2026)', false);
Map.addLayer(longsorRecovery, {palette: ['#00FFFF']}, '7. Sisa Risiko Longsor (Recovery)', false);

// =====================================================
// [7] EXPORT DATA TABULAR (CSV) KE GOOGLE DRIVE
// =====================================================

// 7A. Ekstraksi Data Bencana
var dataTabelBencana = zBencana.reduceRegions({
  collection: aoi,
  reducer: ee.Reducer.mean(),
  scale: 1000
});

Export.table.toDrive({
  collection: dataTabelBencana,
  description: 'Tabel_ZScore_Bencana_2025', 
  folder: 'GEE_Banjir_Sumatera',
  fileFormat: 'CSV'
});

// 7B. Ekstraksi Data Recovery (Untuk Modul 8)
var dataTabelRecovery = zRecovery.reduceRegions({
  collection: aoi,
  reducer: ee.Reducer.mean(),
  scale: 1000
});

Export.table.toDrive({
  collection: dataTabelRecovery,
  description: 'Tabel_ZScore_Recovery_2026',
  folder: 'GEE_Banjir_Sumatera',
  fileFormat: 'CSV'
});