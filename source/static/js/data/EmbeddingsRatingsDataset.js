import Utils from "../Utils.js";
import Dataset from "./Dataset.js";


/**
 * Wrapper class providing the specified dataset itself plus the corresponding crossfilter context and various utility
 * methods. */
export default class EmbeddingsRatingsDataset extends Dataset {
    /**
     *
     * @param name
     * @param embeddingRecords All embedding records.
     * @param binCount Number of bins in histograms.
     */
    constructor(name, embeddingRecords)
    {
        super(name, null);

        this._data              = [];
        this._numRecords        = embeddingRecords.length;
        this._crossfilterData   = null;

        this._initEmbeddingsRatingsData(embeddingRecords);
    }


    /**
     * Initializes crossfilter setup for embedding ratings data.
     * @param embeddingRecords
     * @private
     */
    _initEmbeddingsRatingsData(embeddingRecords)
    {
        this._ratings       = embeddingRecords.map(record => ({id: record.id, rating: -1}));
        this._crossfilter   = crossfilter(this._ratings);

        // Create dimensions.
        this._cf_dimensions["id"]               = this._crossfilter.dimension(d => d["id"]);
        this._cf_dimensions["rating"]           = this._crossfilter.dimension(d => d["rating"]);
        this._cf_dimensions["rating#histogram"] = this._cf_dimensions["rating"];

        // Create groups.
        this._cf_groups["rating#histogram"] = this._generateGroupWithCounts("rating");

        // Determine extrema.
        this._calculateSingularExtremaByAttribute("id");
        this._calculateExtremaForAttribute("rating#histogram");
        this._cf_extrema["rating"]              = {min: -1, max: 5};
        this._cf_intervals["rating"]            = this._cf_extrema["rating"].max - this._cf_extrema["rating"].min;
        this._cf_intervals["rating#histogram"]  = this._cf_extrema["rating#histogram"].max - this._cf_extrema["rating#histogram"].min;

    }

    /**
     * Generates crossfilter group with information on number of elements..
     * @param attribute
     * @returns Newly generated group.
     * @private
     */
    _generateGroupWithCounts(attribute)
    {
        return this._cf_dimensions[attribute].group().reduce(
            function(elements, item) {
                elements.items.add(item);
                elements.ids.add(item.id);
                elements.count++;
                return elements;
            },
            function(elements, item) {
                elements.items.delete(item);
                elements.ids.delete(item.id);
                elements.count--;
                return elements;
            },
            function() {
                return { items: new Set(), count: 0, ids: new Set() };
            }
        );
    }

}