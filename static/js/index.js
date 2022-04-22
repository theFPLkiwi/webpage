
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

var app = new Vue({
    el: '#app',
    data: {
        games: [],
        colors: ['#DE8892', 'white', '#9FDC7C'],
        thresholds: [0, 0.5, 1],
        vals: [],
        keys: [],
        start_gw: null,
        horizon: 5,
        scaled_color: scaled_color,
        table_data_ready: false,
        no_space_col_names: false
    },
    computed: {
        last_gw() {
            return Math.min(this.start_gw + this.horizon, 39)
        }
    },
    methods: {
        init_table() {
            $("#proj_table").DataTable().destroy()
            this.$nextTick(() => {
                let t = $("#proj_table").DataTable({
                    "order": [[ 5, 'desc' ]],
                    "lengthChange": true,
                    "pageLength": 15,
                    "searching": true,
                    "info": true,
                    "paging": true,
                    "columnDefs": [
                        // {
                        // "targets": [0],
                        // "orderable": false
                        // }
                    ],
                    "buttons": [
                        { 'extend': 'csv', 'text': 'Download as CSV'},
                        { 'text': 'Get raw data', 'action': (e,dt,node,config) => {
                            window.open('https://raw.githubusercontent.com/theFPLkiwi/webpage/main/data/Projected_FPL_2122.csv');
                        }}
                    ],
                    "fixedHeader": true,
                    "scrollX": true,
                    "lengthMenu": [ 5, 15, 25, 50, 100 ]
                });
                t.buttons().container()
                    .appendTo('#buttons');
            })
        },
        change_horizon() {
            $("#proj_table").DataTable().destroy()
            let value = document.getElementById("horizonSelect").value
            app.table_data_ready = false
            app.$nextTick(() => {
                app.horizon = parseInt(value)
                app.$nextTick(() => {
                    app.table_data_ready = true
                    app.$nextTick(() => {
                        app.init_table()
                    })
                })
            })
        }
    }
})

async function fetch_latest_data() {
    return new Promise((resolve, reject) => {
        let dt = Date.now()
        $.ajax({
            type: "GET",
            url: `data/Projected_FPL_2122.csv?dt=${dt}`,
            dataType: "text",
            async: true,
            success: function(data) {
                tablevals = data.split('\n').map(i => i.split(',').map(j => j.trim()));
                keys = tablevals[0];
                let ref_keys = []
                let suffix = ''
                for (let index = 0; index < keys.length; index++) {
                    if (isNaN(keys[index])) {
                        ref_keys.push(keys[index])
                        suffix = keys[index]
                    }
                    else {
                        if (app.start_gw == null) {
                            app.start_gw = parseInt(keys[index])
                        }
                        ref_keys.push(suffix + " " + keys[index])
                    }
                }
                values = tablevals.slice(1)
                values.splice(-1) // remove empty last row
                let f_data = values.map(i => _.zipObject(ref_keys, i));
                app.keys = ref_keys
                app.vals = f_data
                app.table_data_ready = true
                app.$nextTick(() => {
                    app.init_table()
                })
            },
            error: function(xhr, status, error) {
                console.log(error);
                console.error(xhr, status, error);
                reject("No data");
            }
        });
    });
}

$(document).ready(() => {
    Promise.all([
        fetch_latest_data()
        ]).then(() => {
            console.log('ready')
        })
})