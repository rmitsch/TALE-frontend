import Chart from "./Chart.js";
import Utils from "../Utils.js"


/**
 * Creates chart for surrogate model.
 * Supported so far: Decision tree.
 * Code for tree: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
 * Alternative: http://bl.ocks.org/pprett/3813537.
 */
export default class SurrogateModelChart extends Chart
{
    /**
     *
     * @param name
     * @param panel
     * @param attributes Ignored.
     * @param dataset
     * @param style
     * @param parentDivID
     */
    constructor(name, panel, attributes, dataset, style, parentDivID)
    {
        super(name, panel, attributes, dataset, style, parentDivID);

        this._charts = {};
        this._attributes = {
            rulesTable: ["rule", "precision", "recall", "support", "from", "to"]
        };
        this._divStructure = this._createDivStructure();

        // Construct table; fill it.
        this.constructCFChart();
        this._initTableData();
    }

    /**
     * Construction happens at rendering time.
     */
    constructCFChart()
    {
        this._constructRulesTable();
    }

    _initTableData()
    {
        let records             = this._dataset._cf_dimensions["precision"].top(Infinity);
        let transformedRecords  = [records.length];

        // Transform records to format accepted by DataTable.
        for (let i = 0; i < records.length; i++) {
            let transformedRecord   = [this._attributes.rulesTable.length + 1];
            transformedRecord[0]    = i;
            for (let j = 0; j < this._attributes.rulesTable.length; j++) {
                transformedRecord[j + 1] = records[i][this._attributes.rulesTable[j]];
            }
            transformedRecords[i] = transformedRecord;
        }

        this._charts.rulesTable.rows.add(transformedRecords);
        this._charts.rulesTable.draw();
    }

    /**
     * Construct rules table.
     * @private
     */
    _constructRulesTable()
    {
        const tableID = this._divStructure.tableID;

        this._charts.rulesTable = $("#" + tableID).DataTable({
            scrollX: true,
            scrollY: Math.floor($("#" + this._panel._target).height()) + "px",
            fixedColumns: false
        });

        let instance    = this;
        const table     = $("#" + tableID + " tbody");
        const stage     = instance._panel._operator._stage;
        // stage.addKeyEventListener(this, SurrogateModelChart.processKeyEvent);

        // On hover: Highlight data point on hover in scatterplots & histograms.
        table.on('mouseenter', 'tr', function () {
            // if (instance._charts.rulesTable.row(this).data() !== null)
                // console.log("mouseenter");
            }
        );
        // Clear highlighting on mouseout.
        table.on('mouseout', 'tr', function () {
            // console.log("mouseout");
        });

        // On (double-)click: Open detail view.
        table.on('dblclick', 'td', function (e) {
            // Instruct model detail operator to load data for the selected model.
            // console.log("dblclick");
        });

        // On click: Filter.
        table.on('click', 'td', function (e) {
            const row           = instance._charts.rulesTable.row(this);
            const selectedID    = row.data()[0];

            // console.log("click");
        });

        // -------------------------------------
        // Add divs for column histograms.
        // -------------------------------------

        console.log("***  +++")
        const histogramParentDivID = tableID + "-scrollBody";
        $("#" + tableID).parent().attr("id", histogramParentDivID);
        let histogramParent = $("#" + histogramParentDivID);
        console.log(histogramParent)

        console.log("***")

        const rowsWithoutHistograms = new Set(["ID", "rule"]);
        for (let i = 0; i < this._attributes.rulesTable.length; i++) {
            const columnTitle = this._attributes.rulesTable[i];
            if (!rowsWithoutHistograms.has(columnTitle)) {
                console.log("spawning " + columnTitle + " in " + histogramParentDivID)
                let histogramDiv = Utils.spawnChildDiv(
                    histogramParentDivID,
                    "surrogate-model-table-histogram-" + columnTitle,
                    "surrogate-model-table-histogram"
                );
            }
        }
    }

    /**
     * Resets canvas and updates dataset.
     * @param dataset
     */
    reset(dataset)
    {
        this._dataset = dataset;
    }

    /**
     * Constructs and draws chart drawing decision tree.
     * Source: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
     */
    render()
    {
        this._charts.rulesTable.draw();
        let panelDiv = $("#" + this._target);

        // Update sizes.
        $("#" + this._target + " .dataTables_scrollBody").css(
            'height', Math.floor(panelDiv.height() - 317) + "px"
        );
        this.fitHistograms();
    }

    resize()
    {
        console.log("resize");

        let panelDiv = $("#" + this._target);

        // Update table height.
        if (panelDiv.height() !== this._lastPanelSize.height) {
            $("#" + this._target + " .dataTables_scrollBody").css(
                'height', Math.floor(panelDiv.height() - 317) + "px"
            );
        }

        // Update histogram size and positioning.
        if (panelDiv.width() !== this._lastPanelSize.width) {
            this.fitHistograms();
        }

        // Store size of panel at time of last render.
        this._lastPanelSize.width = panelDiv.width();
        this._lastPanelSize.height = panelDiv.height();
    }

    /**
     * Fits histograms to column widths and positions.
     */
    fitHistograms()
    {
        console.log("fitHistograms")
        const rowsWithoutHistograms = new Set(["ID", "rule"]);
        let currX                   = 60 + 36;

        for (let i = 0; i < this._attributes.rulesTable.length; i++) {

            const columnTitle   = this._attributes.rulesTable[i];
            const colWidth      = $("#surrogate-model-table-header-" + columnTitle).width() + 36;

            if (!rowsWithoutHistograms.has(columnTitle)) {
                console.log("rendering for ", columnTitle);
                let histogram = $("#surrogate-model-table-histogram-" + columnTitle);
                histogram.css("left", currX + "px");
                histogram.width(colWidth - 5);
            }

            currX += colWidth;
            console.log(columnTitle, currX, colWidth)
        }

    }

    _createDivStructure()
    {
        let chartDiv = Utils.spawnChildDiv(this._target, null, "surrogate-model-chart");

        // -------------------------------------
        // Create table.
        // -------------------------------------

        let tableDiv    = Utils.spawnChildDiv(this._target, null, "surrogate-model-table-container");
        let table       = document.createElement('table');
        table.id        = Utils.uuidv4();
        table.className = "display";
        $("#" + tableDiv.id).append(table);

        // Create table header.
        let tableHeader             = "<thead><tr><th>ID</th>";
        // Append all hyperparameter to table.
        for (let i = 0; i < this._attributes.rulesTable.length; i++) {
            const columnTitle = this._attributes.rulesTable[i];
            tableHeader += "<th id='surrogate-model-table-header-" + columnTitle + "'>" + columnTitle + "</th>";
        }
        tableHeader += "</tr></thead>";
        $("#" + table.id).append(tableHeader);


        // const rowsWithoutHistograms = new Set(["ID", "rule"]);
        // console.log($(".surrogate-model-table-container").find("th"));
        // console.log($(".surrogate-model-table-container").find("table")[0]);
        // let ths                     = $($(".surrogate-model-table-container").find("thead")[0]).find("th");
        // let histogramDivIDs         = {};
        //
        // ths.each(function(index) {
        //    const columnTitle = $(this).text();
        //
        //    console.log("cT:", columnTitle);
        //
        //    if (!rowsWithoutHistograms.has(columnTitle)) {
        //        let div          = document.createElement('div');
        //        div.id           = "surrogate-model-table-histogram-" + columnTitle;
        //        div.className    = "surrogate-model-table-histogram";
        //        histogramDivIDs[columnTitle] = div.id;
        //        console.log(this);
        //        console.log($(this)[0]);
        //
        //        console.log("appendingx");
        //        // $(div).appendTo(this);
        //
        //        console.log("-------------")
        //    }
        // });
        //
        // console.log($("#surrogate-model-table-header-precision"));
        //
        // -------------------------------------
        // Create metric chooser.
        // -------------------------------------

        let metricChooserDiv = Utils.spawnChildDiv(
            this._target,
            null,
            "metric-chooser",
            "<select>\n" +
            "  <option value=\"r_nx\">R_nx</option>\n" +
            "  <option value=\"stress\">Stress</option>\n" +
            "  <option value=\"classification_accuracy\">RDP</option>\n" +
            "  <option value=\"runtime\">Runtime</option>\n" +
            "</select> "
        );

        // -----------------------
        // Create histogram divs.
        // -----------------------

        return {
            chartDivID: chartDiv.id,
            tableContainerDivID: tableDiv.id,
            tableID: table.id,
            metricChooserDivID: metricChooserDiv.id
        };
    }
}