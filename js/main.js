'use strict';

$(document).ready(function() {
    //for use with time-period controls
    var split_by_data;
    
    //default time period (2 months)
    var past_n_days = 61;
    
    //style dropdowns
    $("select").select2();
    
    var global = {};
    global.options = {
        'show-evolution-over': 'calendar-dates'
    }

    //load dummy data from telemetry
    var filter_before = new Date('2014-05-14');
    var telemetry_loaded = {
        'clicks': false,
        'organic': false,
        'affiliate': false,
        'sponsored': false
    };

    var telemetry_data = {
        'organic_clicks': [],
        'affiliate_clicks': [], 
        'sponsored_clicks': [], 
        'organic_shown': [],
        'affiliate_shown': [],
        'sponsored_shown': []};

    //array since we'll want it to be int-indexed (order is significant)
    var showing_releases = [
        'beta32',
        'beta31',
        'beta30'
    ]
    
    //annotations
    var markers = [{
        'date': new Date('2014-06-10T00:00:00.000Z'),
        'label': 'v30 released'
    },
    {
        'date': new Date('2014-07-22T00:00:00.000Z'),
        'label': 'v31 released'
    }];

    Telemetry.init(function() {
        var dformat = d3.time.format('%Y-%m-%d');

        var versions = Telemetry.versions();
        var version = 'nightly/33';

        Telemetry.measures(version,function(measures) {
            //var measure = 'NEWTAB_PAGE_DIRECTORY_TYPE_CLICKED-by-submission-date'
            var clicked = 'NEWTAB_PAGE_DIRECTORY_TYPE_CLICKED';
            var sponsored = 'NEWTAB_PAGE_DIRECTORY_SPONSORED_SHOWN';
            var affiliate = 'NEWTAB_PAGE_DIRECTORY_AFFILIATE_SHOWN';
            var organic = 'NEWTAB_PAGE_DIRECTORY_ORGANIC_SHOWN';
            var backwards = {
                'NEWTAB_PAGE_DIRECTORY_SPONSORED_SHOWN':'sponsored', 
                'NEWTAB_PAGE_DIRECTORY_AFFILIATE_SHOWN': 'affiliate',
                'NEWTAB_PAGE_DIRECTORY_ORGANIC_SHOWN': 'organic'
            };
                
            if (measures['NEWTAB_PAGE_DIRECTORY_TYPE_CLICKED'] === undefined) {
                return;
            }

            Telemetry.loadEvolutionOverTime(version, clicked,
                                                  function(histogramEvolution) {
                histogramEvolution.each(function(date, histogram) {
                    histogram.map(function(count, start, end, index) {
                        var which = start == 0 ? 'sponsored' : (start == 1 ? 'affiliate' : (start == 2 ? 'organic' : null));
                        if (which && date >= filter_before){
                            telemetry_data[which + '_clicks'].push({'date': date, 'value': count});
                        }
                    });
                });            
            });

            telemetry_loaded['clicks'] = true;
            check_everything(telemetry_data);
            var fff = d3.time.format('%Y-%m-%d');
            var total={'sponsored':0, 'affiliate':0, 'organic':0};
            var all =[['sponsored', sponsored], ['affiliate', affiliate], ['organic', organic]];

            function pull_measure(measure){
                Telemetry.loadEvolutionOverTime(version, measure, function(histogramEvolution) {
                    var full_measure = histogramEvolution.measure();
                    var mm = backwards[histogramEvolution.measure()];

                    histogramEvolution.each(function(date, histogram,j) {
                        if (date >= filter_before){
                            var total = 0;
                            var mm = backwards[histogram.measure()];
                            histogram.each(function(count, start, end, index) {
                                total += count * index;
                            });
                            telemetry_data[mm + '_shown'].push({'date':date, 'value': total, 'type': mm});
                        }
                    });
                    telemetry_loaded[mm] = true;
                    // my hacky version of checking for multiple things to finish before trying to plot data.
                    check_everything(telemetry_data);
                });                
            }
            pull_measure(all[0][1]);
            pull_measure(all[1][1]);
            pull_measure(all[2][1]);
        })

        function check_everything(data) {
            if (telemetry_loaded.clicks && telemetry_loaded.organic && telemetry_loaded.affiliate && telemetry_loaded.sponsored) {
                plot_it(data);
            }
        }

        function plot_it(data){
            assignEventListeners();
            
            //draw the chart on first-load
            split_by_data = moz_chart({
                title: "Submissions",
                description: "The number of submissions for the chosen measure.",
                data: [data['sponsored_shown'],  data['affiliate_shown'], data['organic_shown']],
                width: 700,
                height: 400,
                right: 10,
                area: false,
                target: '#main-chart',
                show_years: true,
                markers: markers,
                x_extended_ticks: true,
                y_extended_ticks: true,
                xax_tick: 0,
                x_accessor: 'date',
                y_accessor: 'value'
            })
        }
        
        //draw histogram
        //todo change this
        drawHistogram({title: 'Beta 32'});
        
        //default color for histogram
        d3.selectAll(".bar rect")
            .classed('area1-color', true);
    })// end Telemetry.init
    
    
    function drawHistogram(options) {
        // Generate a Bates distribution of 10 random variables.
        var values = d3.range(1000).map(d3.random.bates(10));

        // Generate a histogram using twenty uniformly-spaced bins.
        var x = d3.scale.linear()
            .domain([0, 1])
            .range([0, 350 - 0 - 10]);
    
        var data = d3.layout.histogram()
            .bins(x.ticks(20))
            (values);
            
        var title = (options.title) ? options.title : 'Histogram';

        moz_chart({
            title: title,
            description: "A histogram of the buckets for the chosen measure conditioned on release.",
            data: [data],
            chart_type: 'histogram',
            width: 350,
            height: 389,
            left: 30,
            right: 10,
            rollover_callback: function(d, i) {
                $('#histogram svg .active_datapoint')
                    .html('Frequency Count: ' + d.y);
            },
            target: '#histogram',
            y_extended_ticks: true,
            xax_count: 10,
            xax_tick: 5,
            x_accessor: 'x',
            y_accessor: 'y'
        })
    }
    
    //todo, for dummy data only
    function fake_lookup(release) {
        switch(release) {
            case 'beta32':
                return 'sponsored_shown';
            case 'beta31':
                return 'affiliate_shown';
            case 'beta30':
                return 'organic_shown';
        }
    }
    
    //todo, just for dummy data only
    function filterOutDisabledReleases() {
        var data = [];
        
        for(var i=0; i<showing_releases.length; i++) {
            if(showing_releases[i] == '') {
                continue;
            }

            var id = fake_lookup(showing_releases[i]); //todo, judge me not, world
            data.push(telemetry_data[id]);
        }
        
        //check if we need to constrain by time before returning
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
            
            //modify time periods of our lines
            var data = modify_time_period(split_by_data, past_n_days);
            
            //TODO
            //data is the spliced version
            //need to combine this with filterOutDisabledReleases()
            
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
                    
        //call moz_chart, taking into consideration options and filters that 
        //the user has set
        moz_chart({
            title: "Submissions",
            description: "The number of submissions for the chosen measure.",
            data: filterOutDisabledReleases(),
            width: 700,
            height: 400,
            right: 10,
            area: false,
            target: '#main-chart',
            show_years: show_years,
            markers: markers,
            x_extended_ticks: true,
            y_extended_ticks: true,
            xax_tick: 0,
            x_accessor: 'date',
            y_accessor: 'value',
            xax_format: function(d) {
                if(global.options['show-evolution-over'] == 'build-ids') {
                    //use build ids instead of dates
                    var df = d3.time.format('%Y%m%d');
                    return df(d);
                }
                else if(global.options['show-evolution-over'] == 'calendar-dates') {
                    //use calendar rates instead
                    var df = d3.time.format('%b %d');
                    return df(d);
                }
            },
            custom_line_color_map: customerLineToColorMap(),
            max_data_size: showing_releases.length
        });
    }
})// end document.ready