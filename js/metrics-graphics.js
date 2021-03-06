'use strict';

var charts = {};
var globals = {};
globals.link = false;

function moz_chart() {
    var moz = {};
    moz.defaults = {};
    moz.defaults.all = {
        animate_on_load: false,       // animate lines on load
        top: 40,                      // the size of the top margin
        bottom: 30,                   // the size of the bottom margin
        right: 10,                    // size of the right margin
        left: 50,                     // size of the left margin
        buffer: 8,                    // the buffer between the actual chart area and the margins
        width: 350,                   // the width of the entire graphic
        height: 220,                  // the height of the entire graphic
        small_height_threshold: 120,  // the height threshold for when smaller text appears
        small_width_threshold: 160,   // the width  threshold for when smaller text appears
        small_text: false,            // coerces small text regardless of graphic size
        xax_count: 6,                 // number of x axis ticks
        xax_tick: 5,                  // x axis tick length
        yax_count: 5,                 // number of y axis ticks
        yax_tick: 5,                  // y axis tick length
        x_extended_ticks: false,      // extends x axis ticks across chart - useful for tall charts
        y_extended_ticks: false,      // extends y axis ticks across chart - useful for long charts
        y_scale_type: 'linear',
        max_x: null,
        max_y: null,
        min_x: null,
        min_y: null,
        point_size: 2.5,              // the size of the dot that appears on a line on mouse-over
        x_accessor: 'date',
        xax_units: '',
        x_label: '',
        y_accessor: 'value',
        y_label: '',
        yax_units: '',
        transition_on_update: true,
        rollover_callback: null,
        show_rollover_text: true,
        show_confidence_band: null,   // given [l, u] shows a confidence at each point from l to u
        xax_format: function(d) {
            //assume date by default, user can pass in custom function
            var df = d3.time.format('%b %d');
            return df(d);
        },
        area: true,
        chart_type: 'line',   
        data: [],
        decimals: 2,                  // the number of decimals in any rollover
        format: 'count',
        inflator: 10/9,               // for setting y axis max
        linked: false,                // links together all other graphs with linked:true, so rollovers in one trigger rollovers in the others
        list: false,
        baselines: null,              // sets the baseline lines
        markers: null,                // sets the marker lines
        scalefns: {},
        scales: {},
        show_years: true,
        target: '#viz',
        interpolate: 'cardinal',       // interpolation method to use when rendering lines
        custom_line_color_map: [],     // allows arbitrary mapping of lines to colors, e.g. [2,3] will map line 1 to color 2 and line 2 to color 3
        max_data_size: null            // explicitly specify the the max number of line series, for use with custom_line_color_map
    }
    moz.defaults.histogram = {
        rollover_callback: function(d, i) {
            $('#histogram svg .active_datapoint')
                .html('Frequency Count: ' + d.y);
        },
        binned: false,
        bins: null,
        processed_x_accessor: 'x',
        processed_y_accessor: 'y',
        processed_dx_accessor: 'dx',
        bar_margin: 1
    }

    var args = arguments[0];
    if (!args) { args = {}; }
    args = merge_with_defaults(args, moz.defaults.all);

    var g = '';
    if (args.list) {
        args.x_accessor = 0;
        args.y_accessor = 1;
    }
    
    //build the chart
    if(args.chart_type == 'missing-data'){
        charts.missing(args);
    }
    else if(args.chart_type == 'point'){
        charts.point(args).markers().mainPlot().rollover();
    }
    else if(args.chart_type == 'histogram'){
        args = merge_with_defaults(args, moz.defaults.histogram);
        charts.histogram(args).mainPlot().markers().rollover();
    }
    else {
        charts.line(args).markers().mainPlot().rollover();
    }

    return args.data;
}

function chart_title(args) {
    //is chart title different than existing, if so, clear the fine 
    //gentleman, otherwise, move along
    if(args.title && args.title !== $(args.target + ' h2.chart_title').text())
        $(args.target + ' h2.chart_title').remove();
    else
        return;

    if (args.target && args.title) {
        //only show question mark if there's a description
        var optional_question_mark = (args.description)
            ? '<i class="fa fa-question-circle fa-inverse"></i>'
            : '';
    
        $(args.target).prepend('<h2 class="chart_title">' 
            + args.title + optional_question_mark + '</h2>');
            
        //activate the question mark if we have a description
        if (args.description){
            $(args.target + ' h2.chart_title')
                .popover({'content': args.description,
                    'trigger':'hover', 'placement': 'top'});
        }   
    }
}

function xAxis(args) {
    var svg = d3.select(args.target + ' svg');
    var g;
    var min_x;
    var max_x;

    args.scalefns.xf = function(di) {
        return args.scales.X(di[args.x_accessor]);
    }

    var last_i;
    if (args.chart_type == 'line'){
        for(var i=0; i<args.data.length; i++) {
            last_i = args.data[i].length-1;

            if(args.data[i][0][args.x_accessor] < min_x || !min_x)
                min_x = args.data[i][0][args.x_accessor];

            if(args.data[i][last_i][args.x_accessor] > max_x || !max_x)
                max_x = args.data[i][last_i][args.x_accessor];
        }    
    } else if (args.chart_type == 'point') {
        max_x = d3.max(args.data[0], function(d){return d[args.x_accessor]});
        min_x = d3.min(args.data[0], function(d){return d[args.x_accessor]});
    }
    else if (args.chart_type == 'histogram'){
        min_x = d3.min(args.data[0], function(d){return d[args.x_accessor]});
        max_x = d3.max(args.data[0], function(d){return d[args.x_accessor]});
        
        //increase max by one
        max_x = max_x + 1;
        
        //force override xax_format
        //todo revisit to see if this makes sense        
        args.xax_format = function(f) {
            if (f < 1.0) {
                //don't scale tiny values
                return args.yax_units + d3.round(f, args.decimals);
            }
            else {
                var pf = d3.formatPrefix(f);
                return args.xax_units + pf.scale(f) + pf.symbol;
            }
        }
    }

    min_x = args.min_x ? args.min_x : min_x;
    max_x = args.max_x ? args.max_x : max_x;

    args.x_axis_negative = false;
    if (!args.time_series) {
        if (min_x < 0){
            min_x = min_x  - (max_x * (args.inflator-1));
            args.x_axis_negative = true;
        }
    }
    args.scales.X = (args.time_series) 
        ? d3.time.scale() 
        : d3.scale.linear();
        
    args.scales.X
        .domain([min_x, max_x])
        .range([args.left + args.buffer, args.width - args.right - args.buffer]);

    //remove the old x-axis, add new one
    if($(args.target + ' svg .x-axis').length > 0) {
        $(args.target + ' svg .x-axis')
            .remove();
    }

    //x axis
    g = svg.append('g')
        .classed('x-axis', true)
        .classed('x-axis-small', args.use_small_class);

    var last_i = args.scales.X.ticks(args.xax_count).length-1;

    //are we adding a label?
    if(args.x_label) {
        g.append('text')
            .attr('class', 'label')
            .attr('x', function() {
                return args.left + args.buffer
                    + ((args.width - args.right - args.buffer)
                        - (args.left + args.buffer)) / 2;
            })
            .attr('y', args.height - args.bottom / 2)
            .attr('dy', '.50em')
            .attr('text-anchor', 'end')
            .text(function(d) {
                return args.x_label;
            })
    }

    if(!args.x_extended_ticks && !args.y_extended_ticks) {
        //extend axis line across bottom, rather than from domain's min..max
        g.append('line')
            .attr('x1', args.left + args.buffer)
            .attr('x2', args.width - args.right - args.buffer)
            .attr('y1', args.height - args.bottom)
            .attr('y2', args.height - args.bottom);
    }

    //add x ticks
    g.selectAll('.xax-ticks')
        .data(args.scales.X.ticks(args.xax_count)).enter()
            .append('line')
                .attr('x1', args.scales.X)
                .attr('x2', args.scales.X)
                .attr('y1', args.height - args.bottom)
                .attr('y2', function() {
                    return (args.x_extended_ticks)
                        ? args.top
                        : args.height - args.bottom + args.xax_tick;
                })
                .attr('class', function() {
                    if(args.x_extended_ticks)
                        return 'extended-x-ticks';
                });

    g.selectAll('.xax-labels')
        .data(args.scales.X.ticks(args.xax_count)).enter()
            .append('text')
                .attr('x', args.scales.X)
                .attr('y', args.height - args.bottom + args.xax_tick * 7 / 3)
                .attr('dy', '.50em')
                .attr('text-anchor', 'middle')
                .text(function(d) {
                    return args.xax_units + args.xax_format(d);
                })

    //are we adding years to x-axis
    if (args.time_series && args.show_years) {
        var min_x;
        var max_x;

        for (var i=0; i<args.data.length; i++) {
            last_i = args.data[i].length-1;

            if(args.data[i][0][args.x_accessor] < min_x || !min_x)
                min_x = args.data[i][0][args.x_accessor];
            if(args.data[i][last_i][args.x_accessor] > max_x || !max_x)
                max_x = args.data[i][last_i][args.x_accessor];
        }

        var years = d3.time.years(min_x, max_x);

        if (years.length == 0){
            var first_tick = args.scales.X.ticks(args.xax_count)[0];
            years = [first_tick];
        }

        //append year marker to x-axis group
        g = g.append('g')
            .classed('year-marker', true)
            .classed('year-marker-small', args.use_small_class); 

        g.selectAll('.year_marker')
            .data(years).enter()
                .append('line')
                    .attr('x1', args.scales.X)
                    .attr('x2', args.scales.X)
                    .attr('y1', args.top)
                    .attr('y2', args.height - args.bottom);

        var yformat = d3.time.format('%Y');
        g.selectAll('.year_marker')
            .data(years).enter()
                .append('text')
                    .attr('x', args.scales.X)
                    .attr('y', args.height - args.buffer + args.xax_tick)
                    .attr('dy', args.use_small_class ? -3 : (args.y_extended_ticks) ? -6 : 0 )
                    .attr('text-anchor', 'middle')
                    .text(function(d) {
                        return yformat(d);
                    });
    };    

    return this;
}

function yAxis(args) {
    var svg = d3.select(args.target + ' svg');
    var g;

    var min_y, max_y;

    args.scalefns.yf = function(di) {
        return args.scales.Y(di[args.y_accessor]);
    }

    var current_max, current_min;

    for(var i=0; i<args.data.length; i++) {
        if (i == 0){
            max_y = args.data[i][0][args.y_accessor];
            min_y = args.data[i][0][args.y_accessor];
        }
        current_min = d3.min(args.data[i], function(d){return d[args.y_accessor]})
        current_max = d3.max(args.data[i], function(d){return d[args.y_accessor]})

        max_y = Math.max(max_y, current_max);
        min_y = Math.min(min_y, current_min);
    }

    min_y = args.min_y ? args.min_y : min_y;
    max_y = args.max_y ? args.max_y : max_y;

    // we are currently saying that if the min val > 0, set 0 as min y.
    if (min_y >= 0){
        min_y = 0;
        args.y_axis_negative = false;
    } else {
        min_y = min_y  - (max_y * (args.inflator-1));
        args.y_axis_negative = true;
    }

    if (args.y_scale_type == 'log'){
        if (min_y <= 0){
            min_y = 1;
        }
        args.scales.Y = d3.scale.log()
        .domain([min_y, max_y * args.inflator])
        .range([args.height - args.bottom - args.buffer, args.top]);
    } else {
        args.scales.Y = d3.scale.linear()
            .domain([min_y, max_y * args.inflator])
            .range([args.height - args.bottom - args.buffer, args.top]);
    }

    // used for ticks and such, and designed to be paired with log or linear.
    args.scales.Y_axis = d3.scale.linear()
            .domain([min_y, max_y * args.inflator])
            .range([args.height - args.bottom - args.buffer, args.top]);

    var yax_format;
    if (args.format == 'count') {
        yax_format = function(f) {
            if (f < 1.0) {
                // Don't scale tiny values.
                return args.yax_units + d3.round(f, args.decimals);
            } else {
                var pf = d3.formatPrefix(f);
                return args.yax_units + pf.scale(f) + pf.symbol;
            }
        };
    }
    else {
        yax_format = function(d_) {
            var n = d3.format('%p');
            return n(d_);
        }
    }

    //remove the old y-axis, add new one
    if($(args.target + ' svg .y-axis').length > 0) {
        $(args.target + ' svg .y-axis')
            .remove();
    }

    //y axis
    g = svg.append('g')
        .classed('y-axis', true)
        .classed('y-axis-small', args.use_small_class);

    //are we adding a label?
    if(args.y_label) {
        g.append('text')
            .attr('class', 'label')
            .attr('x', function() {
                return -1 * (args.top + args.buffer + 
                        ((args.height - args.bottom - args.buffer)
                            - (args.top + args.buffer)) / 2);
            })
            .attr('y', function() {
                return args.left / 2;
            })
            .attr("dy", "0.4em")
            .attr('text-anchor', 'middle')
            .text(function(d) {
                return args.y_label;
            })
            .attr("transform", function(d) {
                return "rotate(-90)";
            });
    }

    var scale_ticks = args.scales.Y.ticks(args.yax_count);

    function log10(val) {
         //return Math.log(val) / Math.LN10;
         if (val==1000){
            return 3;
         }
         if (val==1000000){
            return 7;
         }
         return Math.log(val) / Math.LN10;
    }
    if (args.y_scale_type == 'log'){
        // get out only whole logs.
        scale_ticks = scale_ticks.filter(function(d){
            return log10(d) % 1 === 0 || log10(d) % 1 < 1-1e6;
        });

    } 

    var last_i = scale_ticks.length-1;
    if(!args.x_extended_ticks && !args.y_extended_ticks) {
        g.append('line')
            .attr('x1', args.left)
            .attr('x2', args.left)
            .attr('y1', args.scales.Y(scale_ticks[0]))
            .attr('y2', args.scales.Y(scale_ticks[last_i]));
    }

    //add y ticks
    g.selectAll('.yax-ticks')
        .data(scale_ticks).enter()
            .append('line')
                .attr('x1', args.left)
                .attr('x2', function() {
                    return (args.y_extended_ticks)
                        ? args.width - args.right
                        : args.left - args.yax_tick;
                })
                .attr('y1', args.scales.Y)
                .attr('y2', args.scales.Y)
                .attr('class', function() {
                    if(args.y_extended_ticks)
                        return 'extended-y-ticks';
                });

    g.selectAll('.yax-labels')
        .data(scale_ticks).enter()
            .append('text')
                .attr('x', args.left - args.yax_tick * 3 / 2)
                .attr('dx', -3).attr('y', args.scales.Y)
                .attr('dy', '.35em')
                .attr('text-anchor', 'end')
                .text(function(d, i) {
                    var o = yax_format(d);
                    return o;
                })

    return this;
}

function raw_data_transformation(args){
    //do we need to turn json data to 2d array?

    if(!$.isArray(args.data[0]))
        args.data = [args.data];
    //

    if ($.isArray(args.y_accessor)){
        args.data = args.data.map(function(_d){
            return args.y_accessor.map(function(ya){
                return _d.map(function(di){
                    di = clone(di);
                    di['multiline_y_accessor'] = di[ya];
                    return di;
                })
            })
        })[0];
        args.y_accessor = 'multiline_y_accessor';
    }

    //sort x-axis data.
    if (args.chart_type == 'line'){
        for(var i=0; i<args.data.length; i++) {
            args.data[i].sort(function(a, b) {
                return a[args.x_accessor] - b[args.x_accessor];
            });
        }
    }
    return this
}

function process_line(args){
    return this;
}

function process_point(args){
    return this;
}

function process_histogram(args){
    // if args.binned=False, then we need to bin the data appropriately.
    // if args.binned=True, then we need to make sure to compute the relevant computed data.
    // the outcome of either of these should be something in args.computed_data.
    // the histogram plotting function will be looking there for the data to plot.

    // we need to compute an array of objects.
    // each object has an x, y, and dx.

    // histogram data is always single dimension
    var our_data = args.data[0];
    var extracted_data;
    if (args.binned==false){
        // use d3's built-in layout.histogram functionality to compute what you need.

        if (typeof(our_data[0]) == 'object'){
            // we are dealing with an array of objects. Extract the data value of interest.
            extracted_data = our_data
                .map(function(d){ 
                    return d[args.x_accessor];
                });
        } else if (typeof(our_data[0]) == 'number'){
            // we are dealing with a simple array of numbers. No extraction needed.
            extracted_data = our_data;
        } 
        // else if (typeof(our_data[0]) == 'string'){
        //     // convert string -> number --- pull request by tlatorre-uchicago.
        //     extracted_data = our_data.map(function(d) { return +d; });
        // }
        var hist = d3.layout.histogram()
        if (args.bins){
            hist = hist.bins(args.bins);
        }
        args.processed_data = hist(extracted_data)
            .map(function(d){
                // extract only the data we need per data point.
                return {'x': d['x'], 'y':d['y'], 'dx': d['dx']};
            })
    } else {
        // here, we just need to reconstruct the array of objects
        // take the x accessor and y accessor.
        // pull the data as x and y. y is count.

        args.processed_data = our_data.map(function(d){
            return {'x': d[args.x_accessor], 'y': d[args.y_accessor]}
        });
        var this_pt;
        var next_pt;
        // we still need to compute the dx component for each data point
        for (var i=0; i < args.processed_data.length; i++){
            this_pt = args.processed_data[i];
            if (i == args.processed_data.length-1){
                this_pt.dx = args.processed_data[i-1].dx;
            } else {
                next_pt = args.processed_data[i+1];
                this_pt.dx = next_pt.x - this_pt.x;
            }
        }
    }
    args.data = [args.processed_data];
    args.x_accessor = args.processed_x_accessor;
    args.y_accessor = args.processed_y_accessor;
    return this;
}

function init(args) {
    var defaults = {
        target: null,
        title: null,
        description: null
    };

    var args = arguments[0];
    if (!args) { args = {}; }
    args = merge_with_defaults(args, defaults);

    //this is how we're dealing with passing in a single array of data, 
    //but with the intention of using multiple values for multilines, etc.

    //do we have a time_series?
    if($.type(args.data[0][0][args.x_accessor]) == 'date') {
        args.time_series = true;
    }
    else {
        args.time_series = false;
    }

    var linked;

    //add svg if it doesn't already exist
    if($(args.target).is(':empty')) {
        //add svg
        d3.select(args.target)
            .append('svg')
                .classed('linked', args.linked)
                .attr('width', args.width)
                .attr('height', args.height);
    }

    var svg = d3.select(args.target).selectAll('svg');

    // remove missing class
    svg.classed('missing', false);
    // remove missing text
    svg.selectAll('.missing-text').remove();

    //add chart title if it's different than existing one
    chart_title(args);

    //we kind of need axes in all cases
    args.use_small_class = args.height - args.top - args.bottom - args.buffer 
            <= args.small_height_threshold 
        && args.width - args.left-args.right - args.buffer*2 
            <= args.small_width_threshold 
        || args.small_text;

    //draw axes
    xAxis(args);
    yAxis(args);

    //if we're updating an existing chart and we have fewer lines than
    //before, remove the outdated lines, e.g. if we had 3 lines, and we're calling
    //moz_chart() on the same target with 2 lines, remove the 3rd line
    if(args.data.length < $(args.target + ' svg .main-line').length) {
        //now, the thing is we can't just remove, say, line3 if we have a custom
        //line-color map, instead, see which are the lines to be removed, and delete those 
        if(args.custom_line_color_map.length > 0) {
            var array_full_series = function(len) {
                var arr = new Array(len);
                for(var i=0;i<arr.length;i++) { arr[i] = i+1; }
                return arr;
            }

            //get an array of lines ids to remove
            var lines_to_remove = arrDiff(
                array_full_series(args.max_data_size), 
                args.custom_line_color_map);

            for(var i=0; i<lines_to_remove.length; i++) {
                $(args.target + ' svg .main-line.line' + lines_to_remove[i] + '-color')
                    .remove();
            }
        }
        //if we don't have a customer line-color map, just remove the lines from the end
        else {
            var num_of_new = args.data.length;
            var num_of_existing = $(args.target + ' svg .main-line').length;

            for(var i=num_of_existing; i>num_of_new; i--) {
                $(args.target + ' svg .main-line.line' + i + '-color').remove();
            }
        }
    }

    return this;
}

function markers(args) {
        var svg = d3.select(args.target + ' svg');
        var gm;
        var gb;

        if(args.markers) {
            if($(args.target + ' svg .markers').length > 0) {
                $(args.target + ' svg .markers')
                    .remove();
            }

            gm = svg.append('g')
                .attr('class', 'markers');

            gm.selectAll('.markers')
                .data(args.markers)
                .enter().append('line')
                    .attr('x1', function(d) {
                        return args.scales.X(d[args.x_accessor])
                    })
                    .attr('x2', function(d) {
                        return args.scales.X(d[args.x_accessor])
                    })
                    .attr('y1', args.top)
                    .attr('y2', function() {
                        return args.height - args.bottom - args.buffer;
                    })
                    .attr('stroke-dasharray', '3,1');

            gm.selectAll('.markers')
                .data(args.markers)
                .enter().append('text')
                    .attr('x', function(d) {
                        return args.scales.X(d[args.x_accessor])
                    })
                    .attr('y', args.top - 8)
                    .attr('text-anchor', 'middle')
                    .text(function(d) {
                        return d['label'];
                    });
        }

        if(args.baselines) {
            svg.selectAll('.baselines').remove();
            gb = svg.append('g')
                .attr('class', 'baselines');

            gb.selectAll('.baselines')
                .data(args.baselines)
                .enter().append('line')
                    .attr('x1', args.left + args.buffer)
                    .attr('x2', args.width-args.right-args.buffer)
                    .attr('y1', function(d){
                        return args.scales.Y(d['value'])})
                    .attr('y2', function(d){return args.scales.Y(d['value'])});

            gb.selectAll('.baselines')
                .data(args.baselines)
                .enter().append('text')
                    .attr('x', args.width-args.right - args.buffer)
                    .attr('y', function(d){return args.scales.Y(d['value'])})
                    .attr('dy', -3)
                    .attr('text-anchor', 'end')
                    .text(function(d) {
                        return d['label'];
                    });
        }

        return this;
    }
    
charts.line = function(args) {
    this.args = args;

    this.init = function(args) {
        raw_data_transformation(args);
        process_line(args);
        init(args);
        return this;
    }

    this.mainPlot = function() {
        var svg = d3.select(args.target + ' svg');
        var g;
        var data_median = 0;

        //main area
        var area = d3.svg.area()
            .x(args.scalefns.xf)
            .y0(args.scales.Y(args.y_scale_type == 'linear' ? 0 : 1))
            .y1(args.scalefns.yf)
            .interpolate(args.interpolate);

        //confidence band
        var confidence_area;
        if(args.show_confidence_band) {
            var confidence_area = d3.svg.area()
                .x(args.scalefns.xf)
                .y0(function(d) {
                    var l = args.show_confidence_band[0];
                    return args.scales.Y(d[l]);
                })
                .y1(function(d) {
                    var u = args.show_confidence_band[1];
                    return args.scales.Y(d[u]);
                })
                .interpolate(args.interpolate);
        }

        //main line
        var line = d3.svg.line()
            .x(args.scalefns.xf)
            .y(args.scalefns.yf)
            .interpolate(args.interpolate);

        //for animating line on first load
        var flat_line = d3.svg.line()
            .x(args.scalefns.xf)
            .y(function() { return args.scales.Y(data_median); })
            .interpolate(args.interpolate);

        for(var i=args.data.length-1; i>=0; i--) {
            //override increment if we have a custom increment series
            var line_id = i+1;
            if(args.custom_line_color_map.length > 0) {
                line_id = args.custom_line_color_map[i];
            }

            //add confidence band
            if(args.show_confidence_band) {
                svg.append('path')
                    .attr('class', 'confidence-band')
                    .attr('d', confidence_area(args.data[i]));
            }

            //add the area
            if(args.area && !args.y_axis_negative && args.data.length <= 1) {
                //if area already exists, transition it
                if($(args.target + ' svg path.area' + (line_id) + '-color').length > 0) {
                    d3.selectAll(args.target + ' svg path.area' + (line_id) + '-color')
                        .transition()
                            .duration(function() {
                                return (args.transition_on_update) ? 1000 : 0;
                            })
                            .attr('d', area(args.data[i]));
                }
                else { //otherwise, add the area
                    svg.append('path')
                        .attr('class', 'main-area ' + 'area' + (line_id) + '-color')
                        .attr('d', area(args.data[i]));
                }
            }

            //add the line, if it already exists, transition the fine gentleman
            if($(args.target + ' svg path.line' + (line_id) + '-color').length > 0) {
                d3.selectAll(args.target + ' svg path.line' + (line_id) + '-color')
                    .transition()
                        .duration(function() {
                            return (args.transition_on_update) ? 1000 : 0;
                        })
                        .attr('d', line(args.data[i]));
            }
            else { //otherwise...
                //if we're animating on load, animate the line from its median value
                if(args.animate_on_load) {
                    data_median = d3.median(args.data[i], function(d) {
                        return d[args.y_accessor];
                    })

                    svg.append('path')
                        .attr('class', 'main-line ' + 'line' + (line_id) + '-color')
                        .attr('d', flat_line(args.data[i]))
                        .transition()
                            .duration(1000)
                            .attr('d', line(args.data[i]));
                }
                else { //or just add the line
                    svg.append('path')
                        .attr('class', 'main-line ' + 'line' + (line_id) + '-color')
                        .attr('d', line(args.data[i]));
                }
            }
        }	    

        return this;
    }

    this.markers = function() {
        markers(args);
        return this;
    };

    this.rollover = function() {
        var svg = d3.select(args.target + ' svg');
        var g;

        //remove the old rollovers if they already exist
        if($(args.target + ' svg .transparent-rollover-rect').length > 0) {
            $(args.target + ' svg .transparent-rollover-rect').remove();
        }
        if($(args.target + ' svg .voronoi').length > 0) {
            $(args.target + ' svg .voronoi').remove();
        }

        //rollover text
        svg.append('text')
            .attr('class', 'active_datapoint')
            .attr('xml:space', 'preserve')
            .attr('x', args.width - args.right)
            .attr('y', args.top / 2)
            .attr('text-anchor', 'end');
                
        //append circle
        svg.append('circle')
            .classed('line_rollover_circle', true)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 0);

        //update our data by setting a unique line id for each series
        //increment from 1... unless we have a custom increment series
        var line_id = 1;

        for(var i=0;i<args.data.length;i++) {
            for(var j=0;j<args.data[i].length;j++) {
                //if custom line-color map is set, use that instead of line_id
                if(args.custom_line_color_map.length > 0) {
                    args.data[i][j]['line_id'] = args.custom_line_color_map[i];
                }
                else {
                    args.data[i][j]['line_id'] = line_id;
                }
            }
            line_id++;
        }

        //for multi-line, use voronoi
        if(args.data.length > 1) {
            //main rollover
            var voronoi = d3.geom.voronoi()
                .x(function(d) { return args.scales.X(d[args.x_accessor]); })
                .y(function(d) { return args.scales.Y(d[args.y_accessor]); });
        
            var g = svg.append('g')
                .attr('class', 'voronoi')

            //we'll be using these when constructing the voronoi rollovers
            var data_nested = d3.nest()
                .key(function(d) { return args.scales.X(d[args.x_accessor]) + "," + args.scales.Y(d[args.y_accessor]); })
                .rollup(function(v) { return v[0]; })
                .entries(d3.merge(args.data.map(function(d) { return d; })))
                .map(function(d) { return d.values; });

            //add the voronoi rollovers
            g.selectAll('path')
                .data(voronoi(data_nested))
                .enter()
                    .append('path')
                        .attr("d", function(d) { return "M" + d.join("L") + "Z"; })
                        .datum(function(d) { return d.point; }) //because of d3.nest, reassign d
                        .attr('class', function(d) {
                            if(args.linked) {
                                var v = d[args.x_accessor];
                                var formatter = d3.time.format('%Y-%m-%d');
                                
                                return 'line' + d['line_id'] + '-color ' + 'roll_' + formatter(v);
                            }
                            else {
                                return 'line' + d['line_id'] + '-color';
                            }
                        })
                        .on('mouseover', this.rolloverOn(args))
                        .on('mouseout', this.rolloverOff(args));
        }
        //for single line, use rects
        else {
            //set to 1 unless we have a custom increment series
            var line_id = 1;
            if(args.custom_line_color_map.length > 0) {
                line_id = args.custom_line_color_map[0];
            }

            var g = svg.append('g')
                .attr('class', 'transparent-rollover-rect')

            g.selectAll('.rollover-rects')
                .data(args.data[0]).enter()
                    .append('rect')
                        .attr('class', function(d, i) {
                            if(args.linked) {
                                var v = d[args.x_accessor];
                                var formatter = d3.time.format('%Y-%m-%d');
                                
                                //only format when y-axis is date
                                var id = (typeof v === 'number')
                                        ? i
                                        : formatter(v);
                                        
                                return 'line' + line_id + '-color ' + 'roll_' + id;
                            }
                            else {
                                return 'line' + line_id + '-color';
                            }
                        })
                        .attr('x', function(d, i) {
                            var current_x = d;
                            var x_coord;

                            if (i == 0) {
                                var next_x = args.data[0][1];
                                x_coord = args.scalefns.xf(current_x) 
                                    - (args.scalefns.xf(next_x) - args.scalefns.xf(current_x))
                                    / 2;
                            }
                            else {
                                var width = args.scalefns.xf(args.data[0][1])
                                    - args.scalefns.xf(args.data[0][0]);
                                
                                x_coord = args.scalefns.xf(current_x) - width / 2;
                            }

                            return x_coord;    
                        })
                        .attr('y', function(d, i) {
                            return (args.data.length > 1)
                                ? args.scalefns.yf(d) - 6 //multi-line chart sensitivity
                                : args.top;
                        })
                        .attr('width', function(d, i) {
                            if (i != args.data[0].length - 1) {
                                return args.scalefns.xf(args.data[0][i + 1]) 
                                    - args.scalefns.xf(d);
                            }
                            else {
                                return args.scalefns.xf(args.data[0][1])
                                    - args.scalefns.xf(args.data[0][0]);
                            }
                        })
                        .attr('height', function(d, i) {
                            return (args.data.length > 1)
                                ? 12 //multi-line chart sensitivity
                                : args.height - args.bottom - args.top - args.buffer;
                        })
                        .attr('opacity', 0)
                        .on('mouseover', this.rolloverOn(args))
                        .on('mouseout', this.rolloverOff(args));
        }

        return this;
    }

    this.rolloverOn = function(args) {
        var svg = d3.select(args.target + ' svg');
        var x_formatter = d3.time.format('%Y-%m-%d');

        return function(d, i) {
            //show circle on mouse-overed rect
            svg.selectAll('circle.line_rollover_circle')
                .attr('class', "")
                .attr('class', 'area' + d['line_id'] + '-color')
                .classed('line_rollover_circle', true)
                .attr('cx', function() {
                    return args.scales.X(d[args.x_accessor]);
                })
                .attr('cy', function() {
                    return args.scales.Y(d[args.y_accessor]);
                })
                .attr('r', args.point_size)
                .style('opacity', 1);
     
            //trigger mouseover on all rects for this date in .linked charts
            if(args.linked && !globals.link) {
                globals.link = true;

                var v = d[args.x_accessor];
                var formatter = d3.time.format('%Y-%m-%d');

                //only format when y-axis is date
                var id = (typeof v === 'number')
                        ? i
                        : formatter(v);

                //trigger mouseover on matching line in .linked charts
                d3.selectAll('.line' + d['line_id'] + '-color.roll_' + id)
                    .each(function(d, i) {
                        d3.select(this).on('mouseover')(d,i);
                })
            }    

            svg.selectAll('text')
                .filter(function(g, j) {
                    return d == g;
                })
                .attr('opacity', 0.3);

            var fmt = d3.time.format('%b %e, %Y');

            if (args.format == 'count') {
                var num = function(d_) {
                    var is_float = d_ % 1 != 0;
                    var n = d3.format("0,000");
                    d_ = is_float ? d3.round(d_, args.decimals) : d_;
                    return n(d_);
                }
            }
            else {
                var num = function(d_) {
                    var fmt_string = (args.decimals ? '.' + args.decimals : '' ) + '%';
                    var n = d3.format(fmt_string);
                    return n(d_);
                }
            }

            //update rollover text
            if (args.show_rollover_text) {
                svg.select('.active_datapoint')
                    .text(function() {
                        if(args.time_series) {
                            var dd = new Date(+d[args.x_accessor]);
                            dd.setDate(dd.getDate());

                            return fmt(dd) + '  ' + args.yax_units 
                                + num(d[args.y_accessor]);
                        }
                        else {
                            return args.x_accessor + ': ' + num(d[args.x_accessor]) 
                                + ', ' + args.y_accessor + ': ' + args.yax_units 
                                + num(d[args.y_accessor]);
                        }
                    });                
            }

            if(args.rollover_callback) {
                args.rollover_callback(d, i);
            }
        }
    }

    this.rolloverOff = function(args) {
        var svg = d3.select(args.target + ' svg');

        return function(d, i) {
            if(args.linked && globals.link) {
                globals.link = false;

                var v = d[args.x_accessor];
                var formatter = d3.time.format('%Y-%m-%d');

                //only format when y-axis is date
                var id = (typeof v === 'number')
                        ? i
                        : formatter(v);

                d3.selectAll('.roll_' + id)
                    .each(function(d, i){
                        d3.select(this).on('mouseout')(d);
                });
            }

            //remove active datapoint text on mouse out
            svg.selectAll('circle.line_rollover_circle')
                .style('opacity', 0);

            svg.select('.active_datapoint')
                .text('');
        }
    }

    this.init(args);
    return this;
}

charts.histogram = function(args) {
    this.args = args;

    this.init = function(args) {
        raw_data_transformation(args);
        process_histogram(args);
        init(args);
        return this;
    }

    this.mainPlot = function() {
        var svg = d3.select(args.target + ' svg');
        var g;

        //remove the old histogram, add new one
        if($(args.target + ' svg .histogram').length > 0) {
            $(args.target + ' svg .histogram')
                .remove();
        }

        var g = svg.append("g")
            .attr("class", "histogram");

        var bar = g.selectAll(".bar")
            .data(args.data[0])
                .enter().append("g")
                    .attr("class", "bar")
                    .attr("transform", function(d) {
                        //suppress errors when y value is 0
                        var y_val = (d[args.y_accessor] == 0)
                            ? 0
                            : args.scales.Y(d[args.y_accessor]);

                        return "translate(" + args.scales.X(d[args.x_accessor]) 
                            + "," + y_val + ")";
                        });

        //draw bars
        bar.append("rect")
            .attr("x", 1)
            .attr("width", function(d, i) {
                return args.scalefns.xf(args.data[0][1])
                    - args.scalefns.xf(args.data[0][0])
                    - args.bar_margin;
            })
            .attr("height", function(d) {
                if(d[args.y_accessor] == 0)
                    return 0;

                return args.height - args.bottom - args.buffer 
                    - args.scales.Y(d[args.y_accessor]);
            });

        return this;
    }

    this.markers = function() {
        markers(args);
        return this;
    };

    this.rollover = function() {
        var svg = d3.select(args.target + ' svg');
        var g;
        
        //remove the old rollovers if they already exist
        if($(args.target + ' svg .transparent-rollover-rect').length > 0) {
            $(args.target + ' svg .transparent-rollover-rect').remove();
        }
        if($(args.target + ' svg .active_datapoint').length > 0) {
            $(args.target + ' svg .active_datapoint').remove();
        }

        //rollover text
        svg.append('text')
            .attr('class', 'active_datapoint')
            .attr('xml:space', 'preserve')
            .attr('x', args.width)
            .attr('y', args.top / 2)
            .attr('text-anchor', 'end');

        var g = svg.append('g')
            .attr('class', 'transparent-rollover-rect')

        //draw rollover bars
        var bar = g.selectAll(".bar")
            .data(args.data[0])
                .enter().append("g")
                    .attr("class", "rollover-rects")
                    .attr("transform", function(d) {
                        return "translate(" + (args.scales.X(d[args.x_accessor])) + "," + 0 + ")";
                    });

        bar.append("rect")
            .attr("x", 1)
            .attr("y", 0)
            .attr("width", function(d, i) {
                if (i != args.data[0].length - 1) {
                    return args.scalefns.xf(args.data[0][i + 1]) 
                        - args.scalefns.xf(d);
                }
                else {
                    return args.scalefns.xf(args.data[0][1])
                        - args.scalefns.xf(args.data[0][0]);
                }
            })
            .attr("height", function(d) {
                return args.height;
            })
            .attr('opacity', 0)
            .on('mouseover', this.rolloverOn(args))
            .on('mouseout', this.rolloverOff(args));
    }

    this.rolloverOn = function(args) {
        var svg = d3.select(args.target + ' svg');
        var x_formatter = d3.time.format('%Y-%m-%d');

        return function(d, i) {
            svg.selectAll('text')
                .filter(function(g, j) {
                    return d == g;
                })
                .attr('opacity', 0.3);

            var fmt = d3.time.format('%b %e, %Y');
        
            if (args.format == 'count') {
                var num = function(d_) {
                    var is_float = d_ % 1 != 0;
                    var n = d3.format("0,000");
                    d_ = is_float ? d3.round(d_, args.decimals) : d_;
                    return n(d_);
                }
            }
            else {
                var num = function(d_) {
                    var fmt_string = (args.decimals ? '.' + args.decimals : '' ) + '%';
                    var n = d3.format(fmt_string);
                    return n(d_);
                }
            }

            //highlight active bar
            d3.selectAll($(args.target + ' svg .bar :eq(' + i + ')'))
                .classed('active', true);

            //update rollover text
            if (args.show_rollover_text) {
                svg.select('.active_datapoint')
                    .text(function() {
                        if(args.time_series) {
                            var dd = new Date(+d[args.x_accessor]);
                            dd.setDate(dd.getDate());
                            
                            return fmt(dd) + '  ' + args.yax_units 
                                + num(d[args.y_accessor]);
                        }
                        else {
                            return args.x_accessor + ': ' + num(d[args.x_accessor]) 
                                + ', ' + args.y_accessor + ': ' + args.yax_units 
                                + num(d[args.y_accessor]);
                        }
                    });                
            }

            if(args.rollover_callback) {
                args.rollover_callback(d, i);
            }
        }
    }

    this.rolloverOff = function(args) {
        var svg = d3.select(args.target + ' svg');

        return function(d, i) {
            //reset active bar
            d3.selectAll($(args.target + ' svg .bar :eq(' + i + ')'))
                .classed('active', false);
            
            //reset active data point text
            svg.select('.active_datapoint')
                .text('');
        }
    }

    this.init(args);
    return this;
}

charts.point = function(args) {
    this.args = args;

    this.init = function(args) {
        raw_data_transformation(args);
        process_point(args);
        init(args);
        return this;
    }

    this.markers = function() {
        markers(args);
        
        return this
    }

    this.mainPlot = function() {
        var svg = d3.select(args.target + ' svg');
        var g;

        // plot the points, pretty straight-forward
        g = svg.append('g')
            .classed('points', true);

        g.selectAll('circle')
            .data(args.data[0])
            .enter().append('svg:circle')
                .attr('cx', args.scalefns.xf)
                .attr('cy', args.scalefns.yf)
                .attr('r', 2);

        return this;
    }

    this.rollover = function() {
        var svg = d3.select(args.target + ' svg');

        var clips = svg.append('g')
                .attr('id', 'point-clips');

        var paths = svg.append('g')
            .attr('id', 'point-paths');

        clips.selectAll('clipPath')
            .data(args.data[0])
                .enter().append('clipPath')
                    .attr('id', function(d, i) { return 'clip-'+i;})
                    .append('circle')
                        .attr('cx', args.scalefns.xf)
                        .attr('cy', args.scalefns.yf)
                        .attr('r', 20);

        var voronoi = d3.geom.voronoi()
            .x(args.scalefns.xf)
            .y(args.scalefns.yf);

        paths.selectAll('path')
            .data(voronoi(args.data[0]))
            .enter().append('path')
                .attr('d', function(d) { 
                    return 'M' + d.join(',') + 'Z';
                })
                .attr('id', function(d,i) { 
                    return 'path-' + i;
                })
                .attr('clip-path', function(d,i) {
                    return 'url(#clip-'+i+')';
                })
                .style('fill-opacity', 0)
                .on('mouseover', this.rolloverOn(args))
                .on('mouseout', this.rolloverOff(args));

        return this;
    }

    this.rolloverOn = function(args) {
        var svg = d3.select(args.target + ' svg');

        return function(d,i){
            svg.selectAll('.points circle')
                .classed('unselected', true);

            svg.selectAll('.points circle')
                .filter(function(g,j){return i == j})
                .classed('unselected', false)
                .classed('selected', true)
                .attr('r', 3);
        }
    }

    this.rolloverOff = function(args) {
        var svg = d3.select(args.target + ' svg');

        return function(d,i){
            svg.selectAll('.points circle')
                .classed('unselected', false)
                .classed('selected', false)
                .attr('r', 2);
        }
    }

    this.update = function(args) {
        return this;
    }

    this.init(args);

    return this;
}

charts.missing = function(args) {
    this.args = args;

    this.init = function(args) {
        chart_title(args);

        // create svg if one doesn't exist
        d3.select(args.target).selectAll('svg').data([args])
          .enter().append('svg')
            .attr('width', args.width)
            .attr('height', args.height);

        // delete child elements
        d3.select(args.target).selectAll('svg *').remove()

        var svg = d3.select(args.target).select('svg')

        // add missing class
        svg.classed('missing', true);

        svg.append('rect')
            .attr('class', 'missing-pane')
            .attr('x', args.left)
            .attr('y', args.top)
            .attr('width', args.width - (args.left * 2))
            .attr('height', args.height - (args.top * 2));

        var missing_text = 'Data currently missing or unavailable';

        // add missing text
        svg.selectAll('.missing_text').data([missing_text])
          .enter().append('text')
            .attr('class', 'missing-text')
            .attr('x', args.width / 2)
            .attr('y', args.height / 2)
            .attr('dy', '.50em')
            .attr('text-anchor', 'middle')
            .text(missing_text)  

        return this;
    }

    this.init(args);
    return this;
}


//a set of helper functions, some that we've written, others that we've borrowed
function modify_time_period(data, past_n_days) {
    //splice time period
    var data_spliced = clone(data);
    var data_filtered = [];

    //set window_start based on today - past_n_days
    var date_window_start = new Date().getTime() - (past_n_days * 24 * 60 * 60 * 1000);

    //get yesterday's date
    var yesterday = new Date();
    yesterday.setHours(0);
    yesterday.setDate(yesterday.getDate() - 1);

    if(past_n_days != '') {
        for(var i=0; i<data_spliced.length; i++) {
            data_filtered[i] = [];

            if(data_spliced[i] == undefined)
                continue;
            
            var from = data_spliced[i].length - past_n_days;
            data_spliced[i].splice(0,from);

            //filter out data points that are beyond today - past_n_days
            data_spliced[i].map(function(d) {
                if(new Date(d.date).getTime() > date_window_start) {
                    data_filtered[i].push(d);
                }
            });

            //if this release's data is beyond our time period, show it along the 0 axis
            if(data_filtered[i].length <= 1) {
                //add two data points, one at the beginning, one yesterday with value=0
                data_filtered[i].push(
                    {date: new Date(date_window_start), line_id: i+1, value: 0},
                    {date: yesterday, line_id: i+1, value: 0}
                );
            }
        }
    }

    return data_filtered;
}

function convert_dates(data, x_accessor) {
    data = data.map(function(d) {
        var fff = d3.time.format('%Y-%m-%d');
        d[x_accessor] = fff.parse(d[x_accessor]);
        return d;
    });

    return data;
}

var each = function(obj, iterator, context) {
    // yanked out of underscore
    if (obj == null) return obj;
    if (Array.prototype.forEach && obj.forEach === Array.prototype.forEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var k in obj) {
        if (iterator.call(context, obj[k], k, obj) === breaker) return;
      }
    }
    
    return obj;
}

function merge_with_defaults(obj) {
    // taken from underscore
    each(Array.prototype.slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    })
    
    return obj;
}

function number_of_values(data, accessor, value) {
    var values = data.filter(function(d){
        return d[accessor] === value;
    })
    
    return values.length;
}

function has_values_below(data, accessor, value) {
    var values = data.filter(function(d){
        return d[accessor] <= value;
    })
    
    return values.length > 0;
}


function has_too_many_zeros(data, accessor, zero_count) {
    return number_of_values(data, accessor, 0) >= zero_count;
}

//deep copy
//http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }
    
    throw new Error("Unable to copy obj! Its type isn't supported.");
}

//give us the difference of two int arrays
//http://radu.cotescu.com/javascript-diff-function/
function arrDiff(a,b) {
    var seen = [], diff = [];
    for ( var i = 0; i < b.length; i++)
        seen[b[i]] = true;
    for ( var i = 0; i < a.length; i++)
        if (!seen[a[i]])
            diff.push(a[i]);
    return diff;
}
