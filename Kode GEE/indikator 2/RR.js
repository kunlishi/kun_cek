// ============================================================
// SCRIPT GEE: NIGHTTIME LIGHT RECOVERY
// Fokus: Aceh
// Dataset : NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG
// Tujuan  : Mengukur pemulihan intensitas cahaya malam
// Baseline : Maret–Mei 2025 (3 bulan)
// Current  : otomatis data terbaru tersedia
// ============================================================



// ============================================================
// BAGIAN 1. LOAD BATAS WILAYAH DARI ASSETS
// ============================================================

var AOI = ee.FeatureCollection(
  'projects/tbd-arki/assets/batas_provAceh'
);

var AOI_geom = AOI.geometry();

print('Jumlah feature AOI:', AOI.size());

Map.centerObject(AOI, 7);

Map.addLayer(
  AOI,
  {color: 'yellow'},
  'Batas Aceh'
);



// ============================================================
// BAGIAN 2. LOAD DATASET VIIRS
// ============================================================

var viirs = ee.ImageCollection(
  'NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG'
).select([
  'avg_rad',
  'cf_cvg'
]);

print('Contoh data VIIRS:', viirs.first());



// ============================================================
// BAGIAN 3. PREPROCESSING
// ============================================================

// Masking kualitas data
function maskCloud(image) {
  var mask = image
    .select('cf_cvg')
    .gte(1);

  return image.updateMask(mask);
}


// Hilangkan nilai negatif
function removeNegative(image) {
  return image.where(
    image.lt(0),
    0
  );
}


// Clip ke AOI
function clipAOI(image) {
  return image.clip(AOI_geom);
}


// Pipeline preprocessing
function preprocess(image) {

  var img = image.select([
    'avg_rad',
    'cf_cvg'
  ]);

  img = removeNegative(img);

  img = maskCloud(img);

  img = clipAOI(img);

  return img
    .select('avg_rad')
    .copyProperties(
      image,
      ['system:time_start']
    );
}



// ============================================================
// BAGIAN 4. BASELINE
// Maret–Mei 2025 (lebih stabil)
// ============================================================

var baselineCollection = viirs
  .filterDate(
    '2025-03-01',
    '2025-06-01'
  )
  .filterBounds(AOI_geom)
  .map(preprocess);

print(
  'Jumlah citra baseline:',
  baselineCollection.size()
);

var baseline = baselineCollection
  .median()
  .rename('baseline');

print(
  'Baseline image:',
  baseline
);



// ============================================================
// BAGIAN 5. CURRENT
// Ambil data April 2026
// ============================================================

var currentCollection = viirs

  .filterDate(
    '2026-04-01',
    '2026-05-01'
  )

  .filterBounds(AOI_geom)

  .map(preprocess);

print(
  'Jumlah citra current:',
  currentCollection.size()
);


// Gunakan median agar lebih stabil
var current = currentCollection

  .median()

  .rename('current');

print(
  'Current image:',
  current
);


// Cek rentang tanggal
print(
  'Periode current:',
  '1 April 2026 - 30 April 2026'
);

// ============================================================
// BAGIAN 6. HITUNG RECOVERY
// Recovery % = current / baseline × 100
// ============================================================

// Hindari baseline = 0
var baselineSafe = baseline.where(
  baseline.eq(0),
  0.001
);

var recovery = current
  .divide(
    baselineSafe
  )
  .multiply(100)
  .rename(
    'recovery_pct'
  );


// Batasi maksimum 200%
recovery = recovery.where(
  recovery.gt(200),
  200
);

print(
  'Recovery selesai'
);



// ============================================================
// BAGIAN 7. STATISTIK PER KABUPATEN
// ============================================================

var statsKabupaten = recovery.reduceRegions({

  collection: AOI,

  reducer: ee.Reducer.mean()

    .combine(
      ee.Reducer.median(),
      null,
      true
    )

    .combine(
      ee.Reducer.min(),
      null,
      true
    )

    .combine(
      ee.Reducer.max(),
      null,
      true
    ),

  scale: 500
});

print(
  'Statistik per kabupaten:',
  statsKabupaten
);

// ============================================================
// BAGIAN 8. VISUALISASI
// ============================================================

var nightVis = {
  min: 0,
  max: 5,
  palette: [
    '000000',
    '1a1a2e',
    '533483',
    'e94560',
    'f5a623',
    'ffffff'
  ]
};


var recoveryVis = {
  min: 0,
  max: 150,
  palette: [
    'd32f2f',
    'f57c00',
    'fbc02d',
    '66bb6a',
    '1b5e20'
  ]
};


// Baseline
Map.addLayer(
  baseline,
  nightVis,
  'Baseline (Mar–Mei 2025)',
  false
);


// Current
Map.addLayer(
  current,
  nightVis,
  'Current Terbaru',
  false
);


// Recovery
Map.addLayer(
  recovery,
  recoveryVis,
  'Recovery Percentage',
  true
);


// ============================================================
// BAGIAN 9. EXPORT CSV PER KABUPATEN
// ============================================================

var statsNoGeom = statsKabupaten.map(function(f){
  return f.setGeometry(null);
});

Export.table.toDrive({

  collection: statsNoGeom,

  description:
    'Recovery_Per_Kabupaten_Aceh',

  folder:
    'GEE_Recovery',

  fileNamePrefix:
    'recovery_kabupaten_aceh',

  fileFormat:
    'CSV'
});