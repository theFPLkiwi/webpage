// Graphics tab: theFPLkiwi's weekly graphics (reproduced from FPL_viz.xlsx), drawn from the same points table
//   1. next GW's projected points if they play (ConPts), players with P(app) > 10%
//   2. planning points over the horizon (decayed xPts, +2 per no-show)
//   3. top projected points if they play in each of the next 6 GWs, with a gap per point dropped
// Each graphic is an HTML table on the workbook's cell grid: name/points column pairs, 30 rows per column. Every
// name column takes the width of the widest name (or heading) in any of the three graphics.

const G = { loaded: false, rows: [], gws: [] }

const PLANNING_DECAY = 0.88     // the model's planning_gw_decay (fpl_model/config/factors.csv); quoted in the explainer
const APP_THRESHOLD = 0.10      // tables 1 and 3: leave out a player whose chance of playing that GW is 10% or less
const ROWS = 30

// cell backgrounds by team
const TEAM_FILL = {
    LEE: '#ffffff', TOT: '#ffffff',
    FUL: '#f0f0f0', NEW: '#f0f0f0',
    ARS: '#ffdcdc', BRE: '#ffdcdc', NFO: '#ffdcdc', SUN: '#ffdcdc',
    BOU: '#ffb4b4', LIV: '#ffb4b4', MUN: '#ffb4b4',
    HUL: '#f7dbad',
    AVL: '#f5b4ff', CRY: '#f5b4ff',
    BHA: '#b4e1ff', COV: '#b4e1ff', MCI: '#b4e1ff',
    CHE: '#c8c8ff', EVE: '#c8c8ff', IPS: '#c8c8ff',
}

// one column per block of up to 30 players: [position, first rank, last rank, heading]
const POS_COLUMNS = [
    ['GKP', 1, 20, '📊 GK top 20'],
    ['DEF', 1, 30, '🛡️ DEF 1-30'],
    ['DEF', 31, 60, '🛡️ DEF 31-60'],
    ['MID', 1, 30, '⚽ MID 1-30'],
    ['MID', 31, 60, '⚽ MID 31-60'],
    ['FWD', 1, 25, '🎯 FWD top 25'],
]

// six name + points column pairs
const COLGROUP = '<colgroup>' + '<col class="c-nm"><col class="c-pt">'.repeat(6) + '</colgroup>'

// the Fantasy Premier League logo, assembled from its parts so it stays sharp at any size: 'Fantasy' as text in
// Radikal Bold (the nearest public font to Premier Sans), the lion, and 'Premier' / 'League' stacked (cut from
// the Premier League logo)
const fpl_mark = kind => `<div class="fpl-mark ${kind}">
    <span class="fpl-fantasy">Fantasy</span>
    <div class="fpl-pl"><img class="fpl-lion" src="static/img/pl_lion.png" alt="">
        <div class="fpl-words"><img class="fpl-premier" src="static/img/pl_premier.png" alt="Premier">
        <img class="fpl-league" src="static/img/pl_league.png" alt="League"></div></div></div>`

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// a player's name + points cells, filled in their team's colour; ' dotted' marks the second column of a position
function player_cells(p, value, crown, edge) {
    let fill = `background:${TEAM_FILL[p.team] || '#ffffff'}`
    let name = (crown ? '👑 ' : '') + p.name
    return `<td class="nm${edge}" style="${fill}">${esc(name)}</td><td class="pt" style="${fill}">${value.toFixed(2)}</td>`
}

// graphics 1 and 2: positions in columns, sorted by points; the GK and FWD columns end early, leaving
// the corners for the logos and the explainer
function position_graphic(title_gw, key, eligible, explainer, cls) {
    let lists = POS_COLUMNS.map(([pos, a, b]) =>
        _.orderBy(G.rows.filter(r => r.pos === pos && eligible(r)), key, 'desc').slice(a - 1, b))
    let top = _.max(_.flatten(lists).map(key))
    let head = POS_COLUMNS.map(([pos, a, b, h], c) =>
        `<th colspan="2" class="${c === 2 || c === 4 ? 'dl' : ''}${c === 1 || c === 3 ? ' dr' : ''}">${esc(c === 0 ? title_gw + ' ' + h : h)}</th>`
    ).join('')
    let body = ''
    for (let i = 0; i < ROWS; i++) {
        body += '<tr>'
        lists.forEach((list, c) => {
            let edge = c === 2 || c === 4 ? ' dl' : ''
            let p = list[i]
            if (p) { body += player_cells(p, key(p), key(p) === top, edge); return }
            // corners: GK column from row 21 (kiwi, handle, explainer), FWD column from row 26 (FPL logo)
            if (i === list.length && c === 0)
                body += `<td colspan="2" rowspan="${ROWS - i}" class="corner${edge}"><div class="corner-stack">
                    <img class="corner-kiwi" src="static/img/kiwi.png" alt="theFPLkiwi logo">
                    <div class="corner-handle">@theFPLkiwi</div>
                    <div class="corner-text">${esc(explainer)}</div></div></td>`
            else if (i === list.length && c === POS_COLUMNS.length - 1)
                body += `<td colspan="2" rowspan="${ROWS - i}" class="corner corner-fpl${edge}">${fpl_mark('stacked')}</td>`
            else if (i < list.length || (c !== 0 && c !== POS_COLUMNS.length - 1))
                body += `<td class="nm empty${edge}"></td><td class="pt empty"></td>`
        })
        body += '</tr>'
    }
    return `<table class="viz ${cls}">${COLGROUP}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

// graphic 3: each GW's best projected points if they play; when a player is more than a point behind the one
// above, blank rows go in first, one per extra point (gap rows = ceil(drop) - 1), within 10 rows
function captains_graphic(gws) {
    let n = 10
    let cols = gws.map(g => {
        let list = _.orderBy(G.rows.filter(r => r.papp[g] > APP_THRESHOLD), r => r.con[g], 'desc')
        let out = [], last = null
        for (let p of list) {
            if (out.length >= n) break
            let v = p.con[g]
            if (last !== null) for (let k = Math.ceil(last - v) - 1; k > 0 && out.length < n; k--) out.push(null)
            if (out.length < n) out.push({ p, v })
            last = v
        }
        while (out.length < n) out.push(null)
        return out
    })
    let head = gws.map(g => `<th colspan="2">GW${g}</th>`).join('')
    let body = ''
    for (let i = 0; i < n; i++) {
        body += '<tr>' + cols.map(col => col[i]
            ? player_cells(col[i].p, col[i].v, false, '')
            : '<td class="nm gap"></td><td class="pt gap"></td>').join('') + '</tr>'
    }
    let banner = `<td colspan="6" class="banner"><div class="banner-row">
        <img class="banner-kiwi" src="static/img/kiwi.png" alt="theFPLkiwi logo">
        <span class="banner-text">@theFPLkiwi top captains</span>
        ${fpl_mark('wide')}</div></td>`
    return `<table class="viz captains">${COLGROUP}<thead><tr>${head}</tr></thead><tbody>${body}</tbody>
        <tfoot><tr>${banner}${banner}</tr></tfoot></table>`
}

function render_graphics() {
    let g0 = G.gws[0], horizon = G.gws.length
    let html = [
        position_graphic(`GW${g0}`, r => r.con[g0], r => r.papp[g0] > APP_THRESHOLD,
            'Projected pts if they play, >10% threshold', 'next-gw'),
        position_graphic(`GW${g0}-...`, r => r.planning, () => true,
            `Next ${horizon} GWs with a ${PLANNING_DECAY} time decay, +2pts per no-show (as if a sub came on)`, 'planning'),
        captains_graphic(G.gws.slice(0, 6)),
    ]
    $('#graphics').html(html.map(h => `<div class="viz-scroll">${h}</div>`).join(''))
    fit_name_columns()
    if (document.fonts) document.fonts.ready.then(fit_name_columns)    // again once Rockwell / Arvo has loaded
}

// widest name (and heading, less its points column) across all graphics -> one width for every name column
function fit_name_columns() {
    let probe = $('<span class="viz-probe"></span>').appendTo('#graphics')
    let width = (text, bold) => probe.toggleClass('bold', bold).text(text)[0].getBoundingClientRect().width
    let pt = $('table.viz col.c-pt').first().width() || 53
    let names = _.uniq($('table.viz td.nm').map((i, td) => td.textContent).get())
    let heads = _.uniq($('table.viz th').map((i, th) => th.textContent).get())
    let w = Math.max(..._.map(names, n => width(n, false) + 8), ..._.map(heads, h => width(h, true) + 8 - pt))
    probe.remove()
    $('#graphics').css('--nm-w', Math.ceil(w) + 'px')
}

async function load_graphics() {
    let dt = Date.now()
    let latest = await $.getJSON(`data/latest.json?dt=${dt}`)
    let text = await $.ajax({ type: 'GET', url: `data/${latest.file}?dt=${dt}`, dataType: 'text' })
    let rows = $.csv.toArrays(text.replace(/^﻿/, '').trim())
    let keys = rows[0]
    G.gws = keys.filter(k => /^\d+$/.test(k)).map(k => parseInt(k)).sort((a, b) => a - b)
    G.rows = rows.slice(1).map(a => {
        let o = _.zipObject(keys, a)
        let r = { name: o.name, team: o.team, pos: o.position, planning: parseFloat(o.planning_points) || 0,
                  con: {}, papp: {} }
        G.gws.forEach(g => { r.con[g] = parseFloat(o['ConPts_' + g]) || 0; r.papp[g] = parseFloat(o['P(app)_' + g]) || 0 })
        return r
    })
    render_graphics()
    G.loaded = true
}

// tabs: #graphics shows the graphics, anything else the projections table
function show_tab() {
    let graphics = location.hash === '#graphics'
    $('#tab-table').toggle(!graphics)
    $('#tab-graphics').toggle(graphics)
    $('.kiwi-tabs .nav-link').each((i, a) => $(a).toggleClass('active', $(a).attr('href') === (graphics ? '#graphics' : '#table')))
    if (graphics && !G.loaded) load_graphics().catch(e => {
        console.error('No graphics data', e)
        $('#graphics').text('Could not load the projections.')
    })
    if (!graphics && $.fn.dataTable.isDataTable('#proj_table')) $('#proj_table').DataTable().columns.adjust()
}

$(window).on('hashchange', show_tab)
$(document).ready(show_tab)
