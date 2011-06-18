//
//  Copyright (c) 2011 <redpill27@gmail.com>
//  This code is freely distributable under the MIT license
//

var hn = {
    formFieldsToDict: function() {
        var data = {};

        $(':input', '#target').not('[class="not-field"]').each(function(){
            data[this.name] = this.value;
        });

        // _.each($(document.forms[0].elements).not('[class="not-field"]'), function(e) {
        //     data[e.name] = e.value;
        // });

        return data;
    },

    formSearchQS: function(data) {
        return [
            "filter[fields][username][]=" + data.username,
            "filter[fields][type][]=comment",
            "sortby=points desc",
            "limit=" + parseInt(data.limit)
        ].join('&');
    },

    updateLocation: function(data) {
        window.location.search = '?' + 
            _.map(data, function(val, field) { return field + '=' + val; }).join('&');
    },


    generateChart: function() {
        var data = this.formFieldsToDict();
        var qs = this.formSearchQS(data);

        this.scriptNode = document.createElement('script');
        this.scriptNode.type = 'text/javascript';
        this.scriptNode.src = "http://api.thriftdb.com/api.hnsearch.com/items/_search?callback=hn.onSearchComplete&" + qs;
        $("body").append(this.scriptNode);
        $('#error-box').empty();
    },


    //
    // callback called from the search API
    // 
    onSearchComplete: function(data) {
        // detach the map and jsonp-script nodes
        $(this.scriptNode).detach();
        $("#chart-map").detach();
        $("#comments-wrapper").empty();
        $("#twitter-wrapper").hide();
        $("#twitter-wrapper img").removeAttr("src");

        if (data.hits === 0) {
            $("#chart").css("display", "none");
            $("<span>No comments found</span>").appendTo($("#error-box"));
            return;
        }

        // retrieve the img map from the server
        var imgQs = hncharts.commentLengthAndPoints(data, hncharts.getChartTitle(data));
        var imgUrl = "http://chart.googleapis.com/chart?" + imgQs
        var that = this;
        $.getJSON("/hn/chart-map.json?" + "chof=validate&" + imgQs, function(data) {
            if (data.chartshape !== undefined) {
                $(that.imageMapTemplate({
                    data : _.select(data.chartshape, function(item) { return item.type === "CIRCLE";})
                })).appendTo($("#chart"));
            }
        });

        var formData = this.formFieldsToDict();
        if (!_.isEmpty(formData.username)) {
            this.loadTwitterProfileImage(formData.username);
        }
        
        // update the document
        $("#chart a").attr("href", imgUrl);
        $("#chart-img").attr("src", imgUrl);
        $("#chart").fadeIn();
        $("#comments-wrapper").html(this.commentsTemplate(data));

        var qs = _.map(formData, function(val, field) { return field + '=' + val; }).join('&');
        $("#permalink input").val("http://bitovod.com/hn/best-of?" + qs);
        var button = this.bestOfButton({qs: qs, data: formData});
        $("#bestof-button textarea").val(button);
        $("#best-of-button-example").html(button);
    },


    loadTwitterProfileImage: function(username) {
        // call the search API
        var that = this;
        $.ajax({
            url: "http://api.thriftdb.com/api.hnsearch.com/users/_search?filter[fields][username][]=" + username,
            dataType: "jsonp",
            success: function(data) {
                if (data.hits == 1) {
                    var match = that.parseTwitterUsername.exec(data.results[0].item.about);
                    if (match !== null) {
                        var twitterUsername = match[1] ? match[1] : match[2];
                        // call the twitter API
                        $.ajax({
                            url: "http://api.twitter.com/1/users/show.json?screen_name=" + twitterUsername, 
                            dataType: "jsonp",
                            success: function(data) {
                                $("#twitter-wrapper img").attr("src", data.profile_image_url)
                                $("#twitter-wrapper a").attr("href", "http://twitter.com/" + twitterUsername);
                                $("#twitter-wrapper").fadeIn();
                            }});
                    }
                }
            }
        });
        
        
    },

    initializeFormFromQs: function() {
        // http://stackoverflow.com/questions/901115/get-query-string-values-in-javascript/2880929#2880929
        var urlParams = {};
        var e,
        a = /\+/g,  // Regex for replacing additional symbol with a space
        r = /([^&=]+)=?([^&]*)/g,
        d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
        q = window.location.search.substring(1);
        while (e = r.exec(q))
            urlParams[d(e[1])] = d(e[2]);

        // if there is no username field then use the default one, if
        // it is there but is empty then leave it empty
        $('#username').val((urlParams.username !== undefined) ? urlParams.username : "pg");
        if (urlParams.limit !== undefined) {
            $('#limit').val(urlParams.limit);
        }
    },

    togglePermalink: function() {
        $('#permalink').slideToggle(300, function() {
            if ($('#permalink').is(':visible')) {
                $('#permalink input').focus().select();
        }
        });
    },

    toggleBestOfButton: function() {
        $('#bestof-button').slideToggle(200, function() {
            if ($('#bestof-button').is(':visible')) {
                $('#bestof-button textarea').focus().select();
            }
        });
    },


    init: function() {
        this.parseTwitterUsername = /twitter.com\/([a-zA-Z0-9_]{1,15})| @([a-zA-Z0-9_]{1,15})/i;
        this.loadTemplates();
        this.initializeFormFromQs();

        $('#username').focus().select();
        $('form').submit(function() { $('#error-box').empty(); });
        
        // generate the chart only if the server is not sending an error message
        if ($("#error-box span").length === 0 ) {
            hn.generateChart();
        }

    },

    loadTemplates: function() {
        this.imageMapTemplate = _.template('<map name="chart-map" id="chart-map"> \
  <% _.each(data, function(r, i) { %> \
  <area name="<%= r.name %>" shape="CIRCLE" coords="<%= r.coords.join(",") %>" href="#c<%= i+1 %>"  title="#<%= i+1 %>"> \
  <% }); %> \
</map>');
        this.commentsTemplate = _.template('<% _.each(results, function(r, i) { %> \
    <div class="comment"> \
      <div class="comment-header"><a name="c<%= i+1 %>" /> \
        <span class="comment-rank">#<%= i+1 %></span>, <%= (r.item.points === null) ? "-" : r.item.points %> points \
        by <a href="http://news.ycombinator.com/user?id=<%= r.item.username %>"><%= r.item.username %></a> | \
        <%= r.item.create_ts.slice(0,10) %> | \
        <a href="http://news.ycombinator.com/item?id=<%= r.item.id %>">link</a> | \
        <a href="http://news.ycombinator.com/item?id=<%= r.item.parent_id %>">parent</a> | \
        <% if (r.item.discussion !== null) { %> \
        on: <a href="http://news.ycombinator.com/item?id=<%= r.item.discussion.id %>"><%= r.item.discussion.title %></a> \
        <% } %> \
      </div> \
      <div class="comment-text"> \
        <%= r.item.text %> \
      </div> \
    </div> \
    <% }); %>');

        this.bestOfButton = _.template([
            '<a href="http://bitovod.com/hn/best-of?<%= qs %>"',
            '   title="The best of <%= data.username %> on Hacker News">',
            '  <img style="border:none"',
            '       src="http://s3.bitovod.com/hn/bestof.png"/>',
            '</a>'].join('\n'));
    }
};


$(function() {
    _.bindAll(hn);
    hn.init();
});


