
let scaled_color = ({
    d,
    min = 0,
    max = 1,
    colors = ["#00adbe", "#838383", "#d9210e"],
    ascending = true
}) => {
    let dom = [-100, 0, 0.5, 1, 100]
    if (ascending) {
        dom = [100, 1, 0.5, 0, -100]
    }
    let v = d3.scaleLinear().domain(dom).range([colors[0], colors[0], colors[1], colors[2], colors[2]])
    return v((d - min) / (max - min))
}

const POS_ORDER = ['GKP', 'DEF', 'MID', 'FWD']

// page state; the table itself is a DataTable over `rows`
const S = {
    rows: [], gws: [], file: null, updated: null,
    horizon: 99, no_space: false, decay: 1,
    pos: new Set(), team: new Set(), cheapest: false,
    ranges: {},            // column key -> {min, max}
    visible: new Set(),    // row indexes passing the filters
    table: null, columns: []
}

const shown_gws = () => S.gws.slice(0, S.horizon)

// decayed total xPts and decay-weighted average xMins over the shown GWs (decay 1 = plain sum / mean)
function recompute() {
    let gws = shown_gws()
    let w = gws.map((g, k) => Math.pow(S.decay, k))
    let wsum = _.sum(w)
    S.rows.forEach(r => {
        r.total = _.sum(gws.map((g, k) => w[k] * r.pts[g]))
        r.avg_min = _.sum(gws.map((g, k) => w[k] * r.min[g])) / wsum
    })
}

const num = (digits, color) => (d, type) =>
    type === 'display'
        ? (color ? `<span style="color:${color(d)}">${d.toFixed(digits)}</span>` : d.toFixed(digits))
        : d

// titles of the total and average columns; No Space style: 9-22_Pts / 9-22_xMins (decayed or not)
function summary_titles() {
    let gws = shown_gws()
    let a = gws[0], b = gws[gws.length - 1]
    if (S.no_space) return [`${a}-${b}_Pts`, `${a}-${b}_xMins`]
    let star = S.decay < 1 ? '*' : ''          // * = decayed, linked to the "Decay per GW*" box
    return [`xPts${star} GW${a}-${b}`, `Avg xMin${star}`]
}

function build_columns() {
    let ns = S.no_space
    let gws = shown_gws()
    let [t_total, t_avg] = summary_titles()
    let cols = [
        { key: 'id', title: 'ID', data: 'id', className: 'text-muted text-right' },
        { key: 'name', title: 'Name', data: 'name', className: 'sticky-left text-left col-name' },
        { key: 'pos', title: 'Pos', data: r => ns ? r.pos[0] : r.pos },
        { key: 'team', title: 'Team', data: 'team' },
        { key: 'price', title: ns ? 'Value' : 'Price', data: r => ns ? Math.round(r.price * 10) : r.price,
          filter: true },
        { key: 'total', title: t_total, data: 'total',
          render: num(2), filter: true, className: 'col-total' },
        { key: 'avg_min', title: t_avg, data: 'avg_min',
          render: num(1), filter: true },
    ]
    gws.forEach(g => {
        cols.push({ key: `pts_${g}`, title: ns ? `${g}_Pts` : `xPts ${g}`, data: r => r.pts[g],
                    render: num(2, d => scaled_color({ d, min: 1, max: 6 })), filter: true })
        cols.push({ key: `min_${g}`, title: ns ? `${g}_xMins` : `xMin ${g}`, data: r => r.min[g],
                    render: num(2, d => scaled_color({ d, min: 40, max: 80 })), filter: true })
    })
    return cols
}

// a column's value as displayed (Value x10 in no-space mode), for the min/max filters
function col_value(col, r) {
    return typeof col.data === 'function' ? col.data(r) : r[col.data]
}

function in_range(key, v) {
    let f = S.ranges[key]
    if (!f) return true
    if (f.min !== '' && f.min != null && v < f.min) return false
    if (f.max !== '' && f.max != null && v > f.max) return false
    return true
}

// work out which rows pass; "cheapest per position" is applied after every other filter
function refilter() {
    let fcols = S.columns.filter(c => c.filter)
    let pass = S.rows.map(r => S.pos.has(r.pos) && S.team.has(r.team)
        && fcols.every(c => in_range(c.key, col_value(c, r))))
    if (S.cheapest) {
        let minp = {}
        S.rows.forEach((r, i) => { if (pass[i]) minp[r.pos] = Math.min(minp[r.pos] ?? Infinity, r.price) })
        pass = pass.map((p, i) => p && S.rows[i].price === minp[S.rows[i].pos])
    }
    S.visible = new Set(pass.flatMap((p, i) => p ? [i] : []))
}

$.fn.dataTable.ext.search.push((settings, searchData, dataIndex) =>
    settings.nTable.id !== 'proj_table' || S.visible.has(dataIndex))

function header_html(cols) {
    let top = cols.map(c => `<th>${c.title}</th>`).join('')
    let filt = cols.map(c => {
        if (!c.filter) return '<th class="filter-cell"></th>'
        let f = S.ranges[c.key] || {}
        let box = b => `<input type="number" step="any" class="colf" data-key="${c.key}" data-b="${b}"
            placeholder="${b}" aria-label="${c.title} ${b}" value="${f[b] ?? ''}">`
        return `<th class="filter-cell">${box('min')}${box('max')}</th>`
    }).join('')
    return `<thead><tr>${top}</tr><tr class="filter-row">${filt}</tr></thead>`
}

function build_table() {
    if (S.table) {
        S.table.destroy()
        $('#proj_table').empty()
        $('#buttons').empty()
    }
    recompute()
    S.columns = build_columns()
    // drop ranges of columns no longer shown
    S.ranges = _.pick(S.ranges, S.columns.map(c => c.key))
    refilter()
    $('#proj_table').html(header_html(S.columns))
    S.table = $('#proj_table').DataTable({
        data: S.rows,
        columns: S.columns.map(c => ({ data: c.data, render: c.render, className: c.className || '' })),
        order: [[5, 'desc']],
        orderCellsTop: true,
        pageLength: 15,
        lengthMenu: [5, 15, 25, 50, 100],
        scrollX: true,
        deferRender: true,
        buttons: [
            { extend: 'csv', text: 'Download as CSV', exportOptions: { format: { header: (d, i) => S.columns[i].title } } },
            { text: 'Get raw data', action: () =>
                window.open('https://raw.githubusercontent.com/theFPLkiwi/webpage/main/data/' + S.file) }
        ]
    })
    S.table.buttons().container().appendTo('#buttons')
}

function redraw() {
    refilter()
    S.table.draw(false)
}

// decay only changes the derived columns: recompute in place, then re-read the data
function apply_decay() {
    recompute()
    let [t_total, t_avg] = summary_titles()
    $(S.table.column(5).header()).text(t_total)
    $(S.table.column(6).header()).text(t_avg)
    S.columns[5].title = t_total
    S.columns[6].title = t_avg
    S.table.rows().invalidate('data')
    redraw()
}

function chips(el, values, set) {
    $(el).html(values.map(v =>
        `<button type="button" class="chip ${set.has(v) ? 'on' : ''}" data-v="${v}" aria-pressed="${set.has(v)}">${v}</button>`
    ).join(''))
}

function render_chips() {
    chips('#posChips', POS_ORDER.filter(p => S.rows.some(r => r.pos === p)), S.pos)
    chips('#teamChips', _.uniq(S.rows.map(r => r.team)).sort(), S.team)
}

function bind_controls() {
    $('#horizonSelect').on('change', e => { S.horizon = parseInt(e.target.value); build_table() })
    $('#headerSelect').on('change', e => {
        S.no_space = e.target.value === 'true'
        S.ranges = _.omit(S.ranges, 'price')         // Price and Value are on different scales
        build_table()
    })
    $('#decayInput').on('change', e => {
        let d = parseFloat(e.target.value)
        if (!(d > 0 && d <= 1)) { d = 1; e.target.value = 1 }
        S.decay = d
        apply_decay()
    })
    $('#cheapestCheck').on('change', e => { S.cheapest = e.target.checked; redraw() })
    const toggle = (el, set) => $(el).on('click', '.chip', e => {
        let v = $(e.currentTarget).data('v')
        set.has(v) ? set.delete(v) : set.add(v)
        render_chips(); redraw()
    })
    toggle('#posChips', S.pos)
    toggle('#teamChips', S.team)
    $('[data-all]').on('click', e => {
        let which = $(e.currentTarget).data('all'), on = $(e.currentTarget).data('on')
        let set = which === 'pos' ? S.pos : S.team
        set.clear()
        if (on) S.rows.forEach(r => set.add(which === 'pos' ? r.pos : r.team))
        render_chips(); redraw()
    })
    // min/max boxes live in the (cloned) table header: delegate, and keep every copy in step
    $(document).on('change', 'input.colf', e => {
        let key = $(e.target).data('key'), b = $(e.target).data('b')
        let v = e.target.value === '' ? '' : parseFloat(e.target.value)
        S.ranges[key] = Object.assign(S.ranges[key] || {}, { [b]: v })
        $(`input.colf[data-key="${key}"][data-b="${b}"]`).val(e.target.value)
        redraw()
    })
    $(document).on('click keydown', 'input.colf', e => e.stopPropagation())
    $('#resetFilters').on('click', () => {
        S.ranges = {}
        S.cheapest = false; $('#cheapestCheck').prop('checked', false)
        S.rows.forEach(r => { S.pos.add(r.pos); S.team.add(r.team) })
        S.table.search('')
        render_chips(); build_table()
    })
}

// data/latest.json names the current table (written by the model's publish step)
async function fetch_latest_data() {
    let dt = Date.now()
    let latest = await $.getJSON(`data/latest.json?dt=${dt}`)
    let text = await $.ajax({ type: "GET", url: `data/${latest.file}?dt=${dt}`, dataType: "text" })
    let rows = $.csv.toArrays(text.replace(/^﻿/, '').trim())
    let keys = rows[0]
    S.gws = keys.filter(k => /^\d+$/.test(k)).map(k => parseInt(k)).sort((a, b) => a - b)
    S.file = latest.file
    S.updated = latest.updated
    S.rows = rows.slice(1).map(a => {
        let o = _.zipObject(keys, a)
        let r = { id: parseInt(o.fpl_id), name: o.name, pos: o.position, team: o.team,
                  price: parseFloat(o.price), pts: {}, min: {} }
        S.gws.forEach(g => { r.pts[g] = parseFloat(o[g]) || 0; r.min[g] = parseFloat(o['xmins_' + g]) || 0 })
        return r
    })
    S.rows.forEach(r => { S.pos.add(r.pos); S.team.add(r.team) })
    $('#updatedLine').text(`Projections for GW${S.gws[0]}-${S.gws[S.gws.length - 1]} · updated ${S.updated}`)
    render_chips()
    bind_controls()
    build_table()
    $('#loading').hide()
    $('#tableArea, #controls').show()
}

$(document).ready(() => {
    fetch_latest_data().then(() => console.log('ready'), e => {
        console.error('No data', e)
        $('#loading').text('Could not load the projections.')
    })
})
