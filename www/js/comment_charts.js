var hn = {
    generateChart: function() {
        var username = $('#username').val();
        var fields = [
            "filter[fields][username][]=" + username,
            "filter[fields][type][]=comment",
            "sortby=points desc",
            "limit=100" ];
        var qs = fields.join('&');

        this.scriptNode = document.createElement('script');
        this.scriptNode.type = 'text/javascript';
        this.scriptNode.src = "http://api.thriftdb.com/api.hnsearch.com/items/_search?callback=hn.onSearchComplete&" + qs;
        $("body").append(this.scriptNode);

        // $.getJSON("http://api.thriftdb.com/api.hnsearch.com/items/_search?callback=hn.onSearchComplete&chof=json" + qs,
        //           function(data) {
        //               console.log(data);
        //           });
    },

    onSearchComplete: function(data) {
        //$("#query-result").html(JSON.stringify(data));
        $(this.scriptNode).detach();
        var imgUrl = hncharts.commentLengthAndPoints(data);
        $("#chart a").attr("href", imgUrl);
        $("#chart img").attr("src", imgUrl);
        $("#chart").css("display", "block");
        $("#comments-wrapper").html(this.commentsTemplate(data));
    },

    init: function() {
        this.commentsTemplate = _.template('<% _.each(results, function(r, i) { %> \
    <div class="comment"> \
      <div class="comment-header"><a name="c<%= i+1 %>" /> \
        <span class="comment-rank">#<%= i+1 %></span>, points: <%= (r.item.points === null) ? "-" : r.item.points %>, \
        <%= r.item.create_ts.slice(0,10) %>, \
        <a href="http://news.ycombinator.com/item?id=<%= r.item.id %>">link</a>, \
        <a href="http://news.ycombinator.com/item?id=<%= r.item.parent_id %>">parent</a>, \
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


