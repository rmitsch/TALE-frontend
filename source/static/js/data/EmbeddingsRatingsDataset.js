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

        this._data          = [];
        this._numRecords    = embeddingRecords.length;
        this._listeners     = {};
        this._initEmbeddingsRatingsData(embeddingRecords);
    }

    /**
     * Adds listener on ratings change. If ratings are changed by other actor, listeners are notified.
     * @param name
     * @param context E. g. instance.
     * @param callback
     */
    addListener(name, context, callback)
    {
        this._listeners[name] = {context: context, callback: callback};
    }

    /**
     * Initializes crossfilter setup for embedding ratings data.
     * @param embeddingRecords
     * @private
     */
    _initEmbeddingsRatingsData(embeddingRecords)
    {
        this._data          = embeddingRecords.map(record => ({id: record.id, rating: 0}));
        this._crossfilter   = crossfilter(this._data);

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
     * Updates crossfilter data, e. g. after a rating was updated.
     * @param embeddingID
     * @private
     */
    _updateCrossfilterData(embeddingID)
    {
        this._crossfilter.remove((record) => record.id === embeddingID);
        this._crossfilter.add([{id: embeddingID, rating: this._data[embeddingID]}]);
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

    /**
     * Updates embedding rating and notifies other listeners of changes.
     * @param embeddingID
     * @param rating
     * @param sourceName
     */
    updateRatings(embeddingID, rating, sourceName)
    {
        this._data[embeddingID] = rating;
        this._updateCrossfilterData(embeddingID);

        for (let listenerName in this._listeners)
            if (listenerName !== sourceName)
                this._listeners[listenerName].callback(this._listeners[listenerName].context, embeddingID, rating);
    }
}