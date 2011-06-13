//
//  Copyright (c) 2011 <redpill27@gmail.com>
//  This code is freely distributable under the MIT license
//

var hncharts = {
    init: function() {
        this.chartXScale = 300;
        this.milisecMonth = 1000 * 60 * 60 * 24 * 31;
        this.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    },


    generateDateLabels: function(start, end, num) {
        function normalize(date) {
            var normalizedDate = new Date(date);
            normalizedDate.setUTCDate(1);
            normalizedDate.setUTCHours(0, 0, 0, 0);
            return normalizedDate;
        }
        
        var delta = _.max([this.milisecMonth, (end - start) / (num - 1)]);
        return _.select(_.map(_.range(num), function(n) {
            return normalize(start + n * delta);
        }), function(n) { return n.getTime()<=end; });
    },


    commentLengthAndPoints: function(data) {
        var that = this;
        var arr = [];
        var startDate = 1e+30;
        var endDate = 0;
        
        // search API results -> [[date, points, commentLength], ...]
        _.each(data.results, function(r) {
            if (r.item.points !== null) {
                var date = new Date(r.item.create_ts)
                
                if (date.getTime() < startDate) {
                    startDate = date.getTime();
                } else if (date.getTime() > endDate) endDate = date.getTime();
                
                arr.push([date, r.item.points, r.item.text.length]);
            }
        });

        var points = _.map(arr, function(item) { return item[1]; });
        var pointsMax = _.max(points);
        var pointsMax = _.max([0, pointsMax + 5]);
        var pointsMin = _.min(points);
        pointsMin = _.max([0, pointsMin - 5]);
        var lengths = _.map(arr, function(item) { return 1000+item[2]; });


        // date labels
        endDate += this.milisecMonth;
        var dateLabels = this.generateDateLabels(startDate, endDate, 6);
        startDate -= this.milisecMonth;
        var span = endDate - startDate;
        
        dateLabels = _.map(dateLabels, function(l) {
            return [Math.round(that.chartXScale * (l.getTime() - startDate)/span),
                    that.months[l.getUTCMonth()] + (l.getUTCFullYear())];
        });

        var scaledTimeStamps = _.map(arr, function(item) {
            return Math.round(that.chartXScale * (item[0].getTime() - startDate) / span);
        });
        
        var options = [
            "cht=s&chs=640x400&chxt=x,y,y&chm=o,00A287A0,0,-1,40,-0.5",
            "chxl=2:|Points|0:|" + _.map(dateLabels, function(d) { return d[1]; }).join("|"),
            "chxp=2,50|0," + _.map(dateLabels, function(d) { return d[0]; } ).join(","),
            "chxr=0,0," + this.chartXScale + "|1," + pointsMin + "," + pointsMax,
            "chds=0," + this.chartXScale + "," + pointsMin + "," + pointsMax + ",0,10000",
            "chd=t:" + scaledTimeStamps.join(',') + '|' + 
                points.join(',') + '|' + lengths.join(',')
        ]
        
        return "https://chart.googleapis.com/chart?" + options.join('&');
    }
    
};

hncharts.init();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = hncharts;
}

