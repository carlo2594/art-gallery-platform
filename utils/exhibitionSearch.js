// utils/exhibitionSearch.js

function buildExhibitionFilter(q = {}, search = '') {
  const filter = {};
  const s = (search || '').trim();
  if (s) {
    filter.title = { $regex: s, $options: 'i' };
  }
  // Support namespaced params to avoid colliding with artwork filters
  const exType = q.ex_type || q.type;
  if (exType) {
    const types = Array.isArray(exType) ? exType : [exType];
    filter['location.type'] = { $in: types };
  }
  // Date range with backward compatibility
  const minDateStr = q.ex_minDate || q.minDate || (q.minYear ? `${q.minYear}-01-01` : null);
  const maxDateStr = q.ex_maxDate || q.maxDate || (q.maxYear ? `${q.maxYear}-12-31` : null);
  if (minDateStr || maxDateStr) {
    filter.startDate = {};
    if (minDateStr) {
      const d = new Date(minDateStr);
      if (!isNaN(d)) filter.startDate.$gte = d;
    }
    if (maxDateStr) {
      const d = new Date(maxDateStr);
      if (!isNaN(d)) filter.startDate.$lte = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    }
  }
  return filter;
}

function getExhibitionSort(sortParam) {
  if (sortParam === 'recent') return { startDate: -1 };
  if (sortParam === 'oldest') return { startDate: 1 };
  return { _id: -1 };
}

async function getExhibitionDateBounds(ExhibitionModel, baseFilter = {}) {
  const bounds = await ExhibitionModel.aggregate([
    { $match: baseFilter },
    { $group: { _id: null, minStart: { $min: '$startDate' }, maxStart: { $max: '$startDate' } } },
    { $project: { _id: 0, minStart: 1, maxStart: 1 } }
  ]);
  const toDateInput = d => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const b = bounds[0] || { minStart: null, maxStart: null };
  return { min: toDateInput(b.minStart), max: toDateInput(b.maxStart) };
}

module.exports = { buildExhibitionFilter, getExhibitionSort, getExhibitionDateBounds };
