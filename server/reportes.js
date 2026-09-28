import ExcelJS from 'exceljs';

const NARANJA = 'FFF37021', AZUL = 'FF27AAE1', GRIS = 'FF37474F', CLARO = 'FFFFF3EA';
const head = (row, color = NARANJA) => row.eachCell(c => {
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
});
const titulo = (ws, text, cols) => {
  ws.mergeCells(1, 1, 1, cols);
  const c = ws.getCell(1, 1); c.value = text;
  c.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
  c.alignment = { vertical: 'middle' }; ws.getRow(1).height = 28;
};

export async function reporteLote(l, cat) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'El Dorado · Granjas (Grupo JHS)';
  const r = l.resumen;

  // Hoja 1: resumen / cierre de lote
  const ws = wb.addWorksheet('Resumen');
  titulo(ws, `Registro de granja de pollo de engorde — Lote ${l.codigo}`, 6);
  const info = [
    ['Granja', l.granja, 'Galpón', l.galpon], ['Raza', l.raza, 'Incubadora', l.incubadora],
    ['Fecha de entrada', l.fecha_entrada, 'Estado', l.estado], ['Aves alojadas', l.aves_alojadas, 'Día de ciclo', r.dia_actual],
  ];
  info.forEach((row, i) => { const x = ws.getRow(3 + i); x.values = row; x.getCell(1).font = x.getCell(3).font = { bold: true, color: { argb: GRIS } }; });
  const k = [
    ['Indicador', 'Valor', 'Estándar / meta'],
    ['Mortalidad acumulada (aves)', r.mort_acum, ''], ['% Mortalidad', r.pct_mort, cat.config.metas?.mortalidad_pct],
    ['Descartes (aves)', r.desc_acum, ''], ['Aves despachadas', r.aves_despachadas, ''], ['Saldo de aves', r.saldo, ''],
    ['ABA acumulado (kg)', r.aba_acum_kg, ''], ['Consumo por ave (g)', r.consumo_ave_g, ''],
    ['Peso promedio (g)', r.peso_g, r.peso_std_g], ['% Dif. peso vs estándar', r.dif_peso_pct, ''],
    ['Ganancia diaria de peso (g/día)', r.gdp, r.gdp_std], ['Conversión alimenticia (FCR)', r.fcr, r.fcr_std],
    ['Desviación genética FCR', r.desv_fcr, ''], ['Viabilidad %', r.viabilidad, ''], ['Edad (días)', r.edad, cat.config.metas?.edad_sacrificio],
    ['Índice de Eficiencia Europeo (IEE)', r.iee, cat.config.metas?.iee], ['% Cumplimiento', r.cumplimiento, ''],
  ];
  k.forEach((row, i) => { const x = ws.getRow(9 + i); x.values = row; if (!i) head(x, AZUL); });
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }];

  // Hoja 2: formato semanal del cuaderno
  const wm = wb.addWorksheet('Semanal');
  titulo(wm, 'Mortalidad y consumo semanal (formato cuaderno de campo)', 16);
  const h1 = wm.getRow(3); h1.values = ['Semana', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'Total sem', 'Desc. sem', 'Acum.', '% Sem', '% Acum', 'Saldo aves']; head(h1, 'FFB23A3A');
  l.semanas.forEach((s, i) => { const row = [s.semana, ...Array.from({ length: 7 }, (_, j) => s.dias[j]?.mort ?? null), s.mort_sem, s.desc_sem, s.mort_acum, s.pct_sem, s.pct_acum, s.saldo]; wm.getRow(4 + i).values = row; });
  const off = 6 + l.semanas.length;
  const h2 = wm.getRow(off); h2.values = ['Semana', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'Total sem (kg)', 'Acum. (kg)', 'g/ave/sem', 'g/ave/día', 'Peso (g)', 'Kg producidos', 'Conversión']; head(h2, 'FF4E8A2F');
  l.semanas.forEach((s, i) => { wm.getRow(off + 1 + i).values = [s.semana, ...Array.from({ length: 7 }, (_, j) => s.dias[j]?.aba ?? null), s.aba_sem, s.aba_acum, s.gr_ave_sem, s.gr_ave_dia, s.peso_g, s.kg_producidos, s.fcr]; });
  wm.columns = Array.from({ length: 16 }, (_, i) => ({ width: i === 0 ? 9 : i > 7 ? 13 : 7 }));

  // Hoja 3: detalle diario
  const wd = wb.addWorksheet('Diario');
  titulo(wd, 'Detalle diario', 15);
  const hd = wd.getRow(3); hd.values = ['Día', 'Fecha', 'Mortalidad', 'Descarte', 'Salidas', 'Saldo', '% Mort. acum', 'ABA kg', 'ABA acum kg', 'g/ave/día', 'Peso g', 'Estándar g', '% Dif', 'FCR', 'Temp °C']; head(hd);
  l.dias.forEach((d, i) => { wd.getRow(4 + i).values = [d.dia, d.fecha, d.mortalidad, d.descarte, d.salidas, d.saldo, d.pct_mort_acum, d.aba_kg, d.aba_acum_kg, d.gr_ave_dia, d.peso_g, d.peso_std_g, d.dif_peso_pct, d.fcr, d.temp]; });
  wd.columns = Array.from({ length: 15 }, () => ({ width: 12 }));
  wd.views = [{ state: 'frozen', ySplit: 3 }];

  // Hoja 4: despachos y beneficio
  const wp = wb.addWorksheet('Despachos');
  titulo(wp, 'Despachos, planta beneficiadora y rendimiento', 12);
  const hp = wp.getRow(3); hp.values = ['Fecha', 'Destino', 'Planta / cliente', 'Aves', 'Kg en pie', 'Peso prom kg', 'Aves recibidas', 'Kg recibidos', 'Merma kg', 'Kg tipo A', 'Kg tipo B', 'Rend. canal %']; head(hp, AZUL);
  l.despachos.forEach((d, i) => {
    const benef = (Number(d.kg_tipo_a) || 0) + (Number(d.kg_tipo_b) || 0);
    wp.getRow(4 + i).values = [d.fecha, d.destino === 'planta' ? 'Planta' : 'Venta en pie', d.planta || d.cliente, d.aves, Number(d.kg_pie), +(d.kg_pie / d.aves).toFixed(3),
      d.aves_recibidas ?? null, d.kg_recibidos != null ? Number(d.kg_recibidos) : null, d.kg_recibidos != null ? +(d.kg_pie - d.kg_recibidos).toFixed(1) : null,
      d.kg_tipo_a != null ? Number(d.kg_tipo_a) : null, d.kg_tipo_b != null ? Number(d.kg_tipo_b) : null, benef ? +(benef / d.kg_pie * 100).toFixed(1) : null];
  });
  wp.columns = Array.from({ length: 12 }, () => ({ width: 14 }));
  return wb.xlsx.writeBuffer();
}

export async function reporteLotes(lotes) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lotes');
  titulo(ws, 'Resumen de lotes — El Dorado · Granjas (Grupo JHS)', 19);
  const h = ws.getRow(3);
  h.values = ['Lote', 'Granja', 'Tipo', 'Galpón', 'Raza', 'Entrada', 'Estado', 'Día', 'Alojadas', 'Mortalidad', '% Mort.', 'Saldo', 'Despachadas', 'ABA kg', 'Peso g', 'Est. g', 'FCR', 'IEE', '% Cumpl.'];
  head(h);
  lotes.forEach((l, i) => {
    const r = l.resumen;
    const row = ws.getRow(4 + i);
    row.values = [l.codigo, l.granja, l.granja_tipo, l.galpon, l.raza, l.fecha_entrada, l.estado, r.dia_actual, l.aves_alojadas, r.mort_acum, r.pct_mort, r.saldo, r.aves_despachadas, r.aba_acum_kg, r.peso_g, r.peso_std_g, r.fcr, r.iee, r.cumplimiento];
    if (i % 2) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLARO } }; });
  });
  ws.columns = [16, 18, 10, 8, 14, 12, 12, 7, 10, 10, 9, 10, 11, 11, 9, 9, 8, 8, 9].map(w => ({ width: w }));
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = { from: 'A3', to: 'S3' };
  return wb.xlsx.writeBuffer();
}
