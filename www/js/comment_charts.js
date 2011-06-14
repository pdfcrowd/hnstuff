//
//  Copyright (c) 2011 <redpill27@gmail.com>
//  This code is freely distributable under the MIT license
//

var hn = {
    generateChart: function() {
        var username = $('#username').val();
        var fields = [
            "filter[fields][username][]=" + username,
            "filter[fields][type][]=comment",
            "sortby=points desc",
            "limit=" + parseInt($("#limit").val(),10)
        ];
        var qs = fields.join('&');

        this.scriptNode = document.createElement('script');
        this.scriptNode.type = 'text/javascript';
        this.scriptNode.src = "http://api.thriftdb.com/api.hnsearch.com/items/_search?callback=hn.onSearchComplete&" + qs;
        $("body").append(this.scriptNode);
    },


    //
    // callback called from the search API
    // 
    onSearchComplete: function(data) {
        // detach the map and jsonp-script nodes
        $(this.scriptNode).detach();
        $("#chart-map").detach();
        $("#comments-wrapper").empty();
        if (data.hits === 0) {
            $("#chart").css("display", "none");
            return;
        }
        // retrieve the img map from the server
        var imgQs = hncharts.commentLengthAndPoints(data);
        var imgUrl = "http://chart.googleapis.com/chart?" + imgQs
        var that = this;
        $.getJSON("/hn/chart-map.json?" + imgQs, function(data) {
            if (data.chartshape !== undefined) {
                $(that.imageMapTemplate({
                    data : _.select(data.chartshape, function(item) { return item.type === "CIRCLE";})
                })).appendTo($("#chart"));
            }
        });
        // update the document
        $("#chart a").attr("href", imgUrl);
        $("#chart img").attr("src", imgUrl);
        $("#chart").css("display", "block");
        $("#comments-wrapper").html(this.commentsTemplate(data));
    },


    init: function() {
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
    }
};


$(function() {
    _.bindAll(hn);
    hn.init();
});


