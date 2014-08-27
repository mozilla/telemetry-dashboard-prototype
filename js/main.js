'use strict';

$(document).ready(function() {
    //todo don't hard-code
    //array since we'll want it to be int-indexed (order is significant)
    //we're hard-coding here, but could easily set it using 'versions' below
    var showing_releases = [
        'nightly/32',
        'nightly/33',
        'nightly/34'
    ];

    //the release that we're selecting by default, for showing the histogram
    var selected_release_seq = 3;

    //telemetry data for a subset of channels/versions for a chosen measure
    var telemetry_data = new Array();

    //default time period (12 months)
    var past_n_days = 365;

    var global = {};
    global.options = {
        'show-evolution-over': 'calendar-dates',
    }

    //annotations
    var markers = [{
        'date': new Date('2014-06-13T00:00:00.000Z'),
        'label': 'v30 released'
    },
    {
        'date': new Date('2014-07-22T00:00:00.000Z'),
        'label': 'v31 released'
    }];

    //populate 3 releases' buttons on first-load
    $.each(showing_releases, function(i, d) {
        $('.btn-release*[data-sequence=' + (i+1) + ']')
            .attr('data-release', showing_releases[i])
            .text(showing_releases[i]);
            
        $('.disable-enable*[data-sequence=' + (i+1) + ']')
            .attr('data-release', showing_releases[i]);
            
        $('.change*[data-sequence=' + (i+1) + ']')
            .attr('data-release', showing_releases[i]);
    });

    //populate dropdown on first-load
    Telemetry.init(function() {
        var versions = Telemetry.versions();
        
        //populate versions in 'change release' dropdown
        console.log(versions);
        populateVersionsDropdown(versions);

        //get one of the versions (todo)
        var version = showing_releases[selected_release_seq-1];

        Telemetry.measures(version, function(measures) {
            //turn into an array
            var measures_arr = d3.entries(measures);

            //sort measures
            measures_arr.sort(function(a, b) {
                if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
                if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
                return 0;
            });

            //populate dropdown with measures
            var options = $(".measure");
            $.each(measures_arr, function(i, d) {
                options.append($("<option />").val(d.key).text(d.key));
            });

            //style dropdowns
            $("select").select2();
            
            //draw charts and assign event listeners and that's about it
            drawChart();
            assignEventListeners();
        });
    });
    
    //populates the versions dropdown in the 'change release' modal
    function populateVersionsDropdown(versions) {
        //sort versions--newer to older
        versions.sort(function(a, b) {
            if (a.toLowerCase() < b.toLowerCase()) return 1;
            if (a.toLowerCase() > b.toLowerCase()) return -1;
            return 0;
        });

        //populate dropdown with measures
        var options = $(".releases-dropdown");
        $.each(versions, function(i, d) {
            options.append($("<option />").val(d).text(d));
        });

        //style dropdowns
        $("select").select2();
    }
    
    //select the chosen version in the versions dropdown
    function refocusVersionsDropdown(version, sequence) {
        console.log(version, sequence);

        $(".releases-dropdown option").each(function () {
            if ($(this).val() == version) {
                $(this).attr("selected", "selected");
                return;
            }
            
            $("select.releases-dropdown").select2();
        });
    }

    //draw line chart and histogram
    function drawChart() {
        console.log("drawing chart");
        
        telemetry_data = new Array();

        Telemetry.init(function() {
            //set selected measure
            var selected_measure = $(".measure option:selected").text();
            console.log("selected measure: ", selected_measure);
        
            //get evolution data for all three versions, regardless of whether or not
            //they're enabled, we'll be filtering them out later
            $.each(selectedReleases(), function(i, version) {
                console.log("populating telemetry_data, getting data for version: ", version);
                //get measures for this version
                Telemetry.measures(version, function(measures) {
                    //check that selected measure is valid
                    if (measures[selected_measure] === undefined) {
                        return;
                    }

                    Telemetry.loadEvolutionOverTime(version, selected_measure, 
                                function(histogramEvolution) {
                        var data = [];

                        histogramEvolution.each(function(date, histogram) {
                            var total = 0;
                            histogram.map(function(count, start, end, index) {
                                total += count * index;
                            });

                            data.push({'date': date, 'value': total});

                        });

                        //add this release's time-series data to telemetry_data
                        telemetry_data[i] = data;

                        //only plot, when we have the data for all releases loaded
                        check_everything(telemetry_data);
                    });
                });
            })

            //only plot, when we have the data for all releases loaded
            function check_everything(data) {
                if (data.length == selectedReleases().length) {
                    console.log(data);

                    //draw the line chart
                    redrawLineChart({});
                }
            }

            //draw histogram
            setTimeout(function() {
                drawHistogram({title: showing_releases[selected_release_seq-1], sequence: selected_release_seq});
            }, 50);

            //default color for histogram
            d3.selectAll(".bar rect")
                .classed('area1-color', true);
        })
    }

    //draw histogram
    function drawHistogram(options) {
        var version = (options.title) ? options.title : 'Histogram';
        var selected_measure = $(".measure option:selected").text();

        Telemetry.init(function() {
            //get evolution data for the selected version
            console.log("drawing histogram: ", version, selected_measure);
            Telemetry.loadEvolutionOverTime(version, selected_measure, function(histogramEvolution) {
                var data = [];
                var histogram = histogramEvolution.range();

                //get the buckets
                histogram.each(function(count, start, end, index) {
                    data[index] = {x: index, y: count};
                });

                //if histogram is exponential, use log scale
                var y_scale_type = (histogram.kind() == 'exponential')
                        ? 'log'
                        : 'linear';

                var baselines = []

                if(histogram.kind() == 'exponential' || histogram.kind() == 'linear') {
                    baselines.push({value:histogram.percentile(50), label: 'median (' + histogram.median().toFixed(2) + ')'});
                    baselines.push({value:histogram.percentile(95), label: '95% (' + histogram.percentile(95).toFixed(2) + ')'});
                }

                //if histogram is exponential, use log scale
                var xax_count = (histogram.kind() == 'flag' || histogram.kind() == 'boolean')
                        ? 2
                        : 10;

                console.log(histogram.kind());

                //draw the histogram
                moz_chart({
                    title: version,
                    description: "A histogram of the buckets for the chosen measure conditioned on release.",
                    data: data,
                    chart_type: 'histogram',
                    width: 550,
                    height: 389,
                    left: 40,
                    right: 40,
                    y_scale_type: y_scale_type,
                    target: '#histogram',
                    y_extended_ticks: true,
                    xax_count: xax_count,
                    xax_tick: 5,
                    bar_margin: 0,
                    baselines: baselines,
                    binned: true,
                    rollover_callback: function(d, i) {
                        var format = d3.format("0,000");

                        $('#histogram svg .active_datapoint')
                            .html('Value: ' + d3.round(d.x,2) +  '   Count: ' + format(d.y));
                    },
                    x_accessor: 'x',
                    y_accessor: 'y'
                })   

                //update histogram color
                d3.selectAll(".bar rect")
                    .classed('area' + options.sequence + '-color', true);   
            });
        })
    }

    //redraw the line chart
    function redrawLineChart(options) {
        //don't show years for build ids or if we explicitly pass that in as an option
        var show_years = (options.show_years == false 
            || global.options['show-evolution-over'] == 'build-ids')
                ? false
                : true;

        var x_label = (options.x_label !== undefined 
            || global.options['show-evolution-over'] == 'build-ids')
                ? 'Build IDs'
                : '';

        //call moz_chart, taking into consideration options and filters that 
        //the user has set
        moz_chart({
            title: "Submissions",
            description: "The number of submissions for the chosen measure.",
            data: filterOutDisabledReleases(),
            width: 500,
            height: 400,
            right: 10,
            area: false,
            target: '#main-chart',
            show_years: show_years,
            markers: markers,
            x_extended_ticks: true,
            y_extended_ticks: true,
            x_label: x_label,
            xax_tick: 0,
            xax_count: 4,
            x_accessor: 'date',
            y_accessor: 'value',
            xax_format: function(d) {
                if(global.options['show-evolution-over'] == 'build-ids') {
                    //use build ids instead of dates
                    var df = d3.time.format('%Y%m%d');
                    return df(d);
                }
                else if(global.options['show-evolution-over'] == 'calendar-dates') {
                    //use calendar dates instead
                    var df = d3.time.format('%b %d');
                    return df(d);
                }
            },
            custom_line_color_map: customerLineToColorMap(),
            max_data_size: showing_releases.length
        });
    }

    //get selected releases, regardless of whether or not they're enabled
    function selectedReleases() {
        var data = [];
        
        $(".btn-release").each(function(i,d) {
            console.log(d, $(d).text());
            data.push($(d).text());
            console.log(data);
        })

        console.log("selected releases: ", data);
        console.log("showing releases: ", showing_releases);
        
        return data;
    }

    //remove disabled lines from the chart
    function filterOutDisabledReleases() {
        var data = [];
        
        for(var i=0; i<showing_releases.length; i++) {
            if(showing_releases[i] == '') {
                continue;
            }

            data.push(telemetry_data[i]);
        }

        //check if we need to constrain by time before returning
        //we need to constrain by past_n_days of latest release only
        console.log("telemetry_data", telemetry_data);
        console.log("data", data, past_n_days);
        data = modify_time_period(data, past_n_days)

        console.log("data in filterOutDisabledReleases", data);
        return data;
    }
    
    //give us an array of colors to map for our lines, based on the disabled/enabled
    //pattern of our lines, e.g. if line is disabled, return [2,3]
    function customerLineToColorMap() {
        var data = [];

        var j = 1; //index for assigning line color to line
        for(var i=0; i<showing_releases.length; i++) {
            if(showing_releases[i] == '') {
                j++;
                continue;
            }

            data.push(j);
            j++;
        }

        console.log("customerlinetocolormap: ", data);
        return data;
    }

    //get count of enabled releases
    function numOfEnabledReleases() {
        //var releases = d3.entries(showing_releases);
        var count = 0;
        showing_releases.map(function(d) { if(d != '') count++; });

        return count;
    }

    //assign event listeners to dom elements
    function assignEventListeners() {
        //switch to release
        $('.btn-release').click(function () {
            var chosen_i = $(this).data('sequence')
            
            //for when we redraw the histogram on measure change
            selected_release_seq = chosen_i;

            //if button is disabled, all bets are off
            if($(this).attr('class') == 'disabled')
                return;

            //redraw histogram
            drawHistogram({title: $(this).text(), sequence: chosen_i});

            //reset all widths
            $('.main-line')
                .css('stroke-width', '1.1px');

            //make selected line thicker
            $('.main-line.line' + chosen_i + '-color')
                .css('stroke-width', '1.8px');

            return false;
        })

        //enable/disable release
        $('.disable-enable').click(function () {
            var chosen_i = $(this).data('sequence');
            var chosen_release = $(this).data('release');

            //update label and dropdown's opacity
            var label = $($(this).children()[0]).text();

            if(label == 'Enable') {
                //add release to our set of releases
                showing_releases[chosen_i-1] = chosen_release;

                //enable this release
                $($(this).children()[0]).html("Disable");
                d3.select('.btn-release.line' + chosen_i + '-legend-box-color')
                    .classed('disabled', false);
                    
                $('.btn-release.line' + chosen_i + '-legend-box-color')
                    .css('opacity', 1);
                    
                $('.btn-release-options.line' + chosen_i + '-legend-box-color')
                    .css('opacity', 1);
            }
            else if(label == 'Disable') {
                //disable the disabled release, while making sure that not all releases
                //will end up being disabled, which would break our chart
                if(numOfEnabledReleases() <= 1) {
                    var this_menu_item = $($(this).children()[0]);
                    var this_menu_items_old_label = this_menu_item.html();
                                        
                    this_menu_item.html("Can't disable them all");
                    
                    setTimeout(function() {
                        //reset its value
                        this_menu_item.html(this_menu_items_old_label);
                    }, 1500);
                    
                    return false;
                }

                //remove release from our set of releases
                showing_releases[chosen_i-1] = '';

                //disable this release
                $($(this).children()[0]).html("Enable");
                d3.select('.btn-release.line' + chosen_i + '-legend-box-color')
                    .classed('disabled', true);

                $('.btn-release.line' + chosen_i + '-legend-box-color')
                    .css('opacity', 0.5);

                $('.btn-release-options.line' + chosen_i + '-legend-box-color')
                    .css('opacity', 0.5);
                    
                console.log(showing_releases);
            }

            //redraw the line chart
            redrawLineChart({});

            return false;
        })

        //telemetry measure
        $('.measure').click(function () {
            var chosen_measure = $(this).val();

            //redraw histogram and line chart
            drawChart();
        });

        //preferences
        $('.options').click(function () {
            var chosen_option = $(this).attr('class').split(' ')[1];
            var chosen_option_value = $(this).val();
            console.log(chosen_option, chosen_option_value);

            //TODO do other stuff to update chart with new option

            //if we're switching the x-axis to build ids, reformat the labels
            if(chosen_option_value == 'build-ids') {
                global.options['show-evolution-over'] = 'build-ids';

                //update data
                redrawLineChart({
                    show_years: false
                });
            }
            //if we're switching the x-axis to calendar dates, reformat the labels
            else if(chosen_option_value == 'calendar-dates') {
                global.options['show-evolution-over'] = 'calendar-dates';

                redrawLineChart({});
            }
        });

        //filter
        $('.filter').click(function () {
            var chosen_filter = $(this).attr('class').split(' ')[1];
            var chosen_filter_value = $(this).val();
            console.log(chosen_filter, chosen_filter_value);

            //TODO do other stuff to update chart with new filters
            //TODO repopulate other dropdowns if necessary, e.g. OS version on OS change
        });

        //change release (having clicked one in the dropdown)
        $('.releases-dropdown').click(function () {
            var chosen_release = $(this).val();
            var chosen_sequence = $($(".open").children()[0]).data('sequence');
            console.log(chosen_release, chosen_sequence);

            //update the button with the newly selected release name
            $('.btn-release*[data-sequence="' + chosen_sequence + '"]')
                .attr('data-release', chosen_release)
                .text(chosen_release);
            $('.disable-enable*[data-sequence="' + chosen_sequence + '"]')
                .attr('data-release', chosen_release);
            $('.change*[data-sequence="' + chosen_sequence + '"]')
                .attr('data-release', chosen_release);

            //update set of releases
            console.log("updating showing_releases :: setting pos i ", chosen_sequence-1, " to ", chosen_release); 
            showing_releases[chosen_sequence-1] = chosen_release;
            console.log(showing_releases);

            //redraw histogram and line chart
            setTimeout(function() {
                drawChart();
            }, 100);
        });

        //have we clicked on 'change' for a particular release
        $('.change').click(function () {
            var chosen_i = $(this).data('sequence'); //doesn't change
            var chosen_release = $(this).attr('data-release'); //since this can change

            //dim the background
            $(".dim").show();

            //show the modal box
            $("#choose-releases-box").show();
            
            refocusVersionsDropdown(chosen_release, chosen_i);

            return false;
        })

        //preferences
        $('.preferences').click(function () {
            var chosen_i = $(this).data('sequence')

            //dim the background
            $(".dim").show();

            //show the modal box
            $("#preferences-box").show();

            return false;
        });
        
        //advanced filter
        $('.advanced-filter').click(function () {
            var chosen_i = $(this).data('sequence')

            //dim the background
            $(".dim").show();

            //show the modal box
            $("#advanced-filter-box").show();

            return false;
        });

        //modal box event listeners
        $(".close_modal_box").click(function(e) {
            $(".dim").hide();
            $(".modal").hide();

            return false;
        });

        $(".dim").click(function(e) {
            $(".dim").hide();
            $(".modal").hide();
        });

        document.onkeydown = function(evt) {
            evt = evt || window.event;
            if (evt.keyCode == 27) {
                $(".dim").hide();
                $(".modal").hide();
            }
        };

        //switch time period
        $('.modify-time-period-controls button').click(function() {
            //update our time period global variable
            past_n_days = $(this).data('time_period');

            //change button state
            $(this).addClass('active')
                .siblings()
                .removeClass('active');

            //update data
            redrawLineChart({});
        })

        //switch between light and dark themes
        $('#dark-css').click(function () {
            $('.missing')
                .css('background-image', 'url(images/missing-data-dark.png)');

            $('.transparent-rollover-rect')
                .attr('fill', 'white');

            $('.pill').removeClass('active');
            $(this).toggleClass('active');

            $('#dark').attr({href : 'css/metrics-graphics-darkness.css'});
            $('#dark-telemetry').attr({href : 'css/telemetry-darkness.css'});

            return false;
        })

        $('#light-css').click(function () {
            $('.missing')
                .css('background-image', 'url(images/missing-data.png)');

            $('.transparent-rollover-rect')
                .attr('fill', 'black');

            $('.pill').removeClass('active');
            $(this).toggleClass('active');

            $('#dark').attr({href : ''});
            $('#dark-telemetry').attr({href : ''});
            $('#light-telemetry').attr({href : 'css/telemetry.css'});
            return false;
        })
    }
})