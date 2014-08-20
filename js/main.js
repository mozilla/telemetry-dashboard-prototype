'use strict';

$(document).ready(function() {
    //for use with time-period controls
    var split_by_data;

    //telemetry data for a subset of channels/versions for a chosen measure
    var telemetry_data = new Array();
    
    //default time period (12 months)
    var past_n_days = 365;
    
    var global = {};
    global.options = {
        'show-evolution-over': 'calendar-dates',
        'selected_measure': ''
    }

    //array since we'll want it to be int-indexed (order is significant)
    var showing_releases = [
        'nightly/34',
        'nightly/33',
        'nightly/32'
    ];
    
    //annotations
    var markers = [{
        'date': new Date('2014-06-13T00:00:00.000Z'),
        'label': 'v30 released'
    },
    {
        'date': new Date('2014-07-22T00:00:00.000Z'),
        'label': 'v31 released'
    }];

    Telemetry.init(function() {
        var versions = Telemetry.versions();
        console.log(versions);
        
        //todo get default version on first-load
        var version = showing_releases[0];

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

            //set selected measure
            global.options['selected_measure'] = measures_arr[0].key;

            //style dropdowns
            $("select").select2();

            //check that selected measure is valid
            if (measures[global.options['selected_measure']] === undefined) {
                return;
            }

            //get evolution data for all three versions
            for(var i=0; i<showing_releases.length; i++) {
                var version = showing_releases[i];

                Telemetry.loadEvolutionOverTime(version, global.options['selected_measure'], function(histogramEvolution) {
	                var data = [];
	                histogramEvolution.each(function(date, histogram) {
	                    var total = 0;
	                    histogram.map(function(count, start, end, index) {
	                        total += count * index;
	                    });
	                    
	                    data.push({'date': date, 'value': total});
	                    
	                });
	                
	                //add this release's time-series data to telemetry_data
	                telemetry_data.push(data);
	                
	                //only plot, when we have the data for all releases loaded
	                check_everything(telemetry_data);
	            });
	        }
        })
        
        //only plot, when we have the data for all releases loaded
        function check_everything(data) {
            if (data.length == 3) {
                plot_it(data);
            }
        }

        //draw evolution chart on first-load
        function plot_it(data){
            //draw the chart on first-load
            split_by_data = moz_chart({
                title: "Submissions",
                description: "The number of submissions for the chosen measure.",
                data: data,
                width: 500,
                height: 400,
                right: 10,
                area: false,
                target: '#main-chart',
                show_years: true,
                markers: markers,
                x_extended_ticks: true,
                y_extended_ticks: true,
                xax_tick: 0,
                xax_count: 4,
                x_accessor: 'date',
                y_accessor: 'value'
            })
        }
        
        //draw histogram
        //todo change this
        drawHistogram({title: showing_releases[0]});
        
        //default color for histogram
        d3.selectAll(".bar rect")
            .classed('area1-color', true);
    })// end Telemetry.init
    
    assignEventListeners();
    
    //draw histogram
    function drawHistogram(options) {
        var title = (options.title) ? options.title : 'Histogram';

        //generate a Bates distribution of 10 random variables
        var values = d3.range(10000).map(d3.random.bates(10));
        var x = d3.scale.linear()
            .domain([0, 1])
            .range([0, 350 - 0 - 10]);
        
        moz_chart({
            title: title,
            description: "A histogram of the buckets for the chosen measure conditioned on release.",
            data: values,
            chart_type: 'histogram',
            width: 550,
            height: 389,
            left: 30,
            right: 10,
            target: '#histogram',
            y_extended_ticks: true,
            xax_count: 10,
            xax_tick: 5,
            bins: 50,
            bar_margin: 2,
            rollover_callback: function(d, i) {
                $('#histogram svg .active_datapoint')
                    .html('Value: ' + d3.round(d.x,2) +  '   Count: ' + d.y);
            },
            x_accessor: 'x',
            y_accessor: 'y'
        })
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
        data = modify_time_period(data, past_n_days)

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

        return data;
    }
    
    function numOfEnabledReleases() {
        //var releases = d3.entries(showing_releases);
        var count = 0;
        showing_releases.map(function(d) { if(d != '') count++; });

        return count;
    }
    
    function assignEventListeners() {
        //switch to release
        $('.btn-release').click(function () {
            var chosen_i = $(this).data('sequence')
            
            //if button is disabled, all bets are off
            if($(this).attr('class') == 'disabled')
                return;
            
            //redraw histogram using dummy date
            drawHistogram({title: $(this).text()});
            
            //update histogram color
            d3.selectAll(".bar rect")
                .classed('area' + chosen_i + '-color', true);
            
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
                console.log(showing_releases);

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
                console.log(showing_releases);
            
                //disable this release
                $($(this).children()[0]).html("Enable");
                d3.select('.btn-release.line' + chosen_i + '-legend-box-color')
                    .classed('disabled', true);
                    

                $('.btn-release.line' + chosen_i + '-legend-box-color')
                    .css('opacity', 0.5);

                $('.btn-release-options.line' + chosen_i + '-legend-box-color')
                    .css('opacity', 0.5);
            }
            
            //update data    
            //remove disabled one from data
            updateDataMySon({});

            return false;
        })
        
        //telemetry measure
        $('.measure').click(function () {
            var chosen_measure = $(this).val();
            console.log(chosen_measure);
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
                updateDataMySon({
                    show_years: false
                });
            }
            //if we're switching the x-axis to calendar dates, reformat the labels
            else if(chosen_option_value == 'calendar-dates') {
                global.options['show-evolution-over'] = 'calendar-dates';
            
                updateDataMySon({});
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
        
        //change release
        $('.releases-dropdown').click(function () {
            var chosen_release = $(this).val();
            var chosen_sequence = $($(".open").children()[0]).data('sequence');
            console.log(chosen_release, chosen_sequence);
            
            //TODO updated the button with the newly selected release
            //TODO do other stuff to update chart
        });
            
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
           
           
        //change release
        $('.change').click(function () {
            var chosen_i = $(this).data('sequence')
            
            //dim the background
            $(".dim").show();

            //show the modal box
            $("#choose-releases-box").show();
            
            return false;
        })
        
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
            updateDataMySon({});
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
    
    //update data
    function updateDataMySon(options) {
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
})// end document.ready