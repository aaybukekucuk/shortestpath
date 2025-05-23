/*
 * This script contains the language-specific data used by searchtools.js,
 * namely the list of stopwords, stemmer, scorer and splitter.
 */

var stopwords = [];


/* Non-minified version is copied as a separate JS file, if available */
/**@constructor*/
BaseStemmer = function() {
    this.setCurrent = function(value) {
        this.current = value;
        this.cursor = 0;
        this.limit = this.current.length;
        this.limit_backward = 0;
        this.bra = this.cursor;
        this.ket = this.limit;
    };

    this.getCurrent = function() {
        return this.current;
    };

    this.copy_from = function(other) {
        this.current          = other.current;
        this.cursor           = other.cursor;
        this.limit            = other.limit;
        this.limit_backward   = other.limit_backward;
        this.bra              = other.bra;
        this.ket              = other.ket;
    };

    this.in_grouping = function(s, min, max) {
        if (this.cursor >= this.limit) return false;
        var ch = this.current.charCodeAt(this.cursor);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) return false;
        this.cursor++;
        return true;
    };

    this.in_grouping_b = function(s, min, max) {
        if (this.cursor <= this.limit_backward) return false;
        var ch = this.current.charCodeAt(this.cursor - 1);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) return false;
        this.cursor--;
        return true;
    };

    this.out_grouping = function(s, min, max) {
        if (this.cursor >= this.limit) return false;
        var ch = this.current.charCodeAt(this.cursor);
        if (ch > max || ch < min) {
            this.cursor++;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0X1 << (ch & 0x7))) == 0) {
            this.cursor++;
            return true;
        }
        return false;
    };

    this.out_grouping_b = function(s, min, max) {
        if (this.cursor <= this.limit_backward) return false;
        var ch = this.current.charCodeAt(this.cursor - 1);
        if (ch > max || ch < min) {
            this.cursor--;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) {
            this.cursor--;
            return true;
        }
        return false;
    };

    this.eq_s = function(s)
    {
        if (this.limit - this.cursor < s.length) return false;
        if (this.current.slice(this.cursor, this.cursor + s.length) != s)
        {
            return false;
        }
        this.cursor += s.length;
        return true;
    };

    this.eq_s_b = function(s)
    {
        if (this.cursor - this.limit_backward < s.length) return false;
        if (this.current.slice(this.cursor - s.length, this.cursor) != s)
        {
            return false;
        }
        this.cursor -= s.length;
        return true;
    };

    /** @return {number} */ this.find_among = function(v)
    {
        var i = 0;
        var j = v.length;

        var c = this.cursor;
        var l = this.limit;

        var common_i = 0;
        var common_j = 0;

        var first_key_inspected = false;

        while (true)
        {
            var k = i + ((j - i) >>> 1);
            var diff = 0;
            var common = common_i < common_j ? common_i : common_j; // smaller
            // w[0]: string, w[1]: substring_i, w[2]: result, w[3]: function (optional)
            var w = v[k];
            var i2;
            for (i2 = common; i2 < w[0].length; i2++)
            {
                if (c + common == l)
                {
                    diff = -1;
                    break;
                }
                diff = this.current.charCodeAt(c + common) - w[0].charCodeAt(i2);
                if (diff != 0) break;
                common++;
            }
            if (diff < 0)
            {
                j = k;
                common_j = common;
            }
            else
            {
                i = k;
                common_i = common;
            }
            if (j - i <= 1)
            {
                if (i > 0) break; // v->s has been inspected
                if (j == i) break; // only one item in v

                // - but now we need to go round once more to get
                // v->s inspected. This looks messy, but is actually
                // the optimal approach.

                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        do {
            var w = v[i];
            if (common_i >= w[0].length)
            {
                this.cursor = c + w[0].length;
                if (w.length < 4) return w[2];
                var res = w[3](this);
                this.cursor = c + w[0].length;
                if (res) return w[2];
            }
            i = w[1];
        } while (i >= 0);
        return 0;
    };

    // find_among_b is for backwards processing. Same comments apply
    this.find_among_b = function(v)
    {
        var i = 0;
        var j = v.length

        var c = this.cursor;
        var lb = this.limit_backward;

        var common_i = 0;
        var common_j = 0;

        var first_key_inspected = false;

        while (true)
        {
            var k = i + ((j - i) >> 1);
            var diff = 0;
            var common = common_i < common_j ? common_i : common_j;
            var w = v[k];
            var i2;
            for (i2 = w[0].length - 1 - common; i2 >= 0; i2--)
            {
                if (c - common == lb)
                {
                    diff = -1;
                    break;
                }
                diff = this.current.charCodeAt(c - 1 - common) - w[0].charCodeAt(i2);
                if (diff != 0) break;
                common++;
            }
            if (diff < 0)
            {
                j = k;
                common_j = common;
            }
            else
            {
                i = k;
                common_i = common;
            }
            if (j - i <= 1)
            {
                if (i > 0) break;
                if (j == i) break;
                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        do {
            var w = v[i];
            if (common_i >= w[0].length)
            {
                this.cursor = c - w[0].length;
                if (w.length < 4) return w[2];
                var res = w[3](this);
                this.cursor = c - w[0].length;
                if (res) return w[2];
            }
            i = w[1];
        } while (i >= 0);
        return 0;
    };

    /* to replace chars between c_bra and c_ket in this.current by the
     * chars in s.
     */
    this.replace_s = function(c_bra, c_ket, s)
    {
        var adjustment = s.length - (c_ket - c_bra);
        this.current = this.current.slice(0, c_bra) + s + this.current.slice(c_ket);
        this.limit += adjustment;
        if (this.cursor >= c_ket) this.cursor += adjustment;
        else if (this.cursor > c_bra) this.cursor = c_bra;
        return adjustment;
    };

    this.slice_check = function()
    {
        if (this.bra < 0 ||
            this.bra > this.ket ||
            this.ket > this.limit ||
            this.limit > this.current.length)
        {
            return false;
        }
        return true;
    };

    this.slice_from = function(s)
    {
        var result = false;
        if (this.slice_check())
        {
            this.replace_s(this.bra, this.ket, s);
            result = true;
        }
        return result;
    };

    this.slice_del = function()
    {
        return this.slice_from("");
    };

    this.insert = function(c_bra, c_ket, s)
    {
        var adjustment = this.replace_s(c_bra, c_ket, s);
        if (c_bra <= this.bra) this.bra += adjustment;
        if (c_bra <= this.ket) this.ket += adjustment;
    };

    this.slice_to = function()
    {
        var result = '';
        if (this.slice_check())
        {
            result = this.current.slice(this.bra, this.ket);
        }
        return result;
    };

    this.assign_to = function()
    {
        return this.current.slice(0, this.limit);
    };
};

// Generated by Snowball 2.1.0 - https://snowballstem.org/

/**@constructor*/
TurkishStemmer = function() {
    var base = new BaseStemmer();
    /** @const */ var a_0 = [
        ["m", -1, -1],
        ["n", -1, -1],
        ["miz", -1, -1],
        ["niz", -1, -1],
        ["muz", -1, -1],
        ["nuz", -1, -1],
        ["m\u00FCz", -1, -1],
        ["n\u00FCz", -1, -1],
        ["m\u0131z", -1, -1],
        ["n\u0131z", -1, -1]
    ];

    /** @const */ var a_1 = [
        ["leri", -1, -1],
        ["lar\u0131", -1, -1]
    ];

    /** @const */ var a_2 = [
        ["ni", -1, -1],
        ["nu", -1, -1],
        ["n\u00FC", -1, -1],
        ["n\u0131", -1, -1]
    ];

    /** @const */ var a_3 = [
        ["in", -1, -1],
        ["un", -1, -1],
        ["\u00FCn", -1, -1],
        ["\u0131n", -1, -1]
    ];

    /** @const */ var a_4 = [
        ["a", -1, -1],
        ["e", -1, -1]
    ];

    /** @const */ var a_5 = [
        ["na", -1, -1],
        ["ne", -1, -1]
    ];

    /** @const */ var a_6 = [
        ["da", -1, -1],
        ["ta", -1, -1],
        ["de", -1, -1],
        ["te", -1, -1]
    ];

    /** @const */ var a_7 = [
        ["nda", -1, -1],
        ["nde", -1, -1]
    ];

    /** @const */ var a_8 = [
        ["dan", -1, -1],
        ["tan", -1, -1],
        ["den", -1, -1],
        ["ten", -1, -1]
    ];

    /** @const */ var a_9 = [
        ["ndan", -1, -1],
        ["nden", -1, -1]
    ];

    /** @const */ var a_10 = [
        ["la", -1, -1],
        ["le", -1, -1]
    ];

    /** @const */ var a_11 = [
        ["ca", -1, -1],
        ["ce", -1, -1]
    ];

    /** @const */ var a_12 = [
        ["im", -1, -1],
        ["um", -1, -1],
        ["\u00FCm", -1, -1],
        ["\u0131m", -1, -1]
    ];

    /** @const */ var a_13 = [
        ["sin", -1, -1],
        ["sun", -1, -1],
        ["s\u00FCn", -1, -1],
        ["s\u0131n", -1, -1]
    ];

    /** @const */ var a_14 = [
        ["iz", -1, -1],
        ["uz", -1, -1],
        ["\u00FCz", -1, -1],
        ["\u0131z", -1, -1]
    ];

    /** @const */ var a_15 = [
        ["siniz", -1, -1],
        ["sunuz", -1, -1],
        ["s\u00FCn\u00FCz", -1, -1],
        ["s\u0131n\u0131z", -1, -1]
    ];

    /** @const */ var a_16 = [
        ["lar", -1, -1],
        ["ler", -1, -1]
    ];

    /** @const */ var a_17 = [
        ["niz", -1, -1],
        ["nuz", -1, -1],
        ["n\u00FCz", -1, -1],
        ["n\u0131z", -1, -1]
    ];

    /** @const */ var a_18 = [
        ["dir", -1, -1],
        ["tir", -1, -1],
        ["dur", -1, -1],
        ["tur", -1, -1],
        ["d\u00FCr", -1, -1],
        ["t\u00FCr", -1, -1],
        ["d\u0131r", -1, -1],
        ["t\u0131r", -1, -1]
    ];

    /** @const */ var a_19 = [
        ["cas\u0131na", -1, -1],
        ["cesine", -1, -1]
    ];

    /** @const */ var a_20 = [
        ["di", -1, -1],
        ["ti", -1, -1],
        ["dik", -1, -1],
        ["tik", -1, -1],
        ["duk", -1, -1],
        ["tuk", -1, -1],
        ["d\u00FCk", -1, -1],
        ["t\u00FCk", -1, -1],
        ["d\u0131k", -1, -1],
        ["t\u0131k", -1, -1],
        ["dim", -1, -1],
        ["tim", -1, -1],
        ["dum", -1, -1],
        ["tum", -1, -1],
        ["d\u00FCm", -1, -1],
        ["t\u00FCm", -1, -1],
        ["d\u0131m", -1, -1],
        ["t\u0131m", -1, -1],
        ["din", -1, -1],
        ["tin", -1, -1],
        ["dun", -1, -1],
        ["tun", -1, -1],
        ["d\u00FCn", -1, -1],
        ["t\u00FCn", -1, -1],
        ["d\u0131n", -1, -1],
        ["t\u0131n", -1, -1],
        ["du", -1, -1],
        ["tu", -1, -1],
        ["d\u00FC", -1, -1],
        ["t\u00FC", -1, -1],
        ["d\u0131", -1, -1],
        ["t\u0131", -1, -1]
    ];

    /** @const */ var a_21 = [
        ["sa", -1, -1],
        ["se", -1, -1],
        ["sak", -1, -1],
        ["sek", -1, -1],
        ["sam", -1, -1],
        ["sem", -1, -1],
        ["san", -1, -1],
        ["sen", -1, -1]
    ];

    /** @const */ var a_22 = [
        ["mi\u015F", -1, -1],
        ["mu\u015F", -1, -1],
        ["m\u00FC\u015F", -1, -1],
        ["m\u0131\u015F", -1, -1]
    ];

    /** @const */ var a_23 = [
        ["b", -1, 1],
        ["c", -1, 2],
        ["d", -1, 3],
        ["\u011F", -1, 4]
    ];

    /** @const */ var /** Array<int> */ g_vowel = [17, 65, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 8, 0, 0, 0, 0, 0, 0, 1];

    /** @const */ var /** Array<int> */ g_U = [1, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 1];

    /** @const */ var /** Array<int> */ g_vowel1 = [1, 64, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];

    /** @const */ var /** Array<int> */ g_vowel2 = [17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 130];

    /** @const */ var /** Array<int> */ g_vowel3 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];

    /** @const */ var /** Array<int> */ g_vowel4 = [17];

    /** @const */ var /** Array<int> */ g_vowel5 = [65];

    /** @const */ var /** Array<int> */ g_vowel6 = [65];

    var /** boolean */ B_continue_stemming_noun_suffixes = false;


    /** @return {boolean} */
    function r_check_vowel_harmony() {
        var /** number */ v_1 = base.limit - base.cursor;
        golab0: while(true)
        {
            var /** number */ v_2 = base.limit - base.cursor;
            lab1: {
                if (!(base.in_grouping_b(g_vowel, 97, 305)))
                {
                    break lab1;
                }
                base.cursor = base.limit - v_2;
                break golab0;
            }
            base.cursor = base.limit - v_2;
            if (base.cursor <= base.limit_backward)
            {
                return false;
            }
            base.cursor--;
        }
        lab2: {
            var /** number */ v_3 = base.limit - base.cursor;
            lab3: {
                if (!(base.eq_s_b("a")))
                {
                    break lab3;
                }
                golab4: while(true)
                {
                    var /** number */ v_4 = base.limit - base.cursor;
                    lab5: {
                        if (!(base.in_grouping_b(g_vowel1, 97, 305)))
                        {
                            break lab5;
                        }
                        base.cursor = base.limit - v_4;
                        break golab4;
                    }
                    base.cursor = base.limit - v_4;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab3;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab6: {
                if (!(base.eq_s_b("e")))
                {
                    break lab6;
                }
                golab7: while(true)
                {
                    var /** number */ v_5 = base.limit - base.cursor;
                    lab8: {
                        if (!(base.in_grouping_b(g_vowel2, 101, 252)))
                        {
                            break lab8;
                        }
                        base.cursor = base.limit - v_5;
                        break golab7;
                    }
                    base.cursor = base.limit - v_5;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab6;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab9: {
                if (!(base.eq_s_b("\u0131")))
                {
                    break lab9;
                }
                golab10: while(true)
                {
                    var /** number */ v_6 = base.limit - base.cursor;
                    lab11: {
                        if (!(base.in_grouping_b(g_vowel3, 97, 305)))
                        {
                            break lab11;
                        }
                        base.cursor = base.limit - v_6;
                        break golab10;
                    }
                    base.cursor = base.limit - v_6;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab9;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab12: {
                if (!(base.eq_s_b("i")))
                {
                    break lab12;
                }
                golab13: while(true)
                {
                    var /** number */ v_7 = base.limit - base.cursor;
                    lab14: {
                        if (!(base.in_grouping_b(g_vowel4, 101, 105)))
                        {
                            break lab14;
                        }
                        base.cursor = base.limit - v_7;
                        break golab13;
                    }
                    base.cursor = base.limit - v_7;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab12;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab15: {
                if (!(base.eq_s_b("o")))
                {
                    break lab15;
                }
                golab16: while(true)
                {
                    var /** number */ v_8 = base.limit - base.cursor;
                    lab17: {
                        if (!(base.in_grouping_b(g_vowel5, 111, 117)))
                        {
                            break lab17;
                        }
                        base.cursor = base.limit - v_8;
                        break golab16;
                    }
                    base.cursor = base.limit - v_8;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab15;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab18: {
                if (!(base.eq_s_b("\u00F6")))
                {
                    break lab18;
                }
                golab19: while(true)
                {
                    var /** number */ v_9 = base.limit - base.cursor;
                    lab20: {
                        if (!(base.in_grouping_b(g_vowel6, 246, 252)))
                        {
                            break lab20;
                        }
                        base.cursor = base.limit - v_9;
                        break golab19;
                    }
                    base.cursor = base.limit - v_9;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab18;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab21: {
                if (!(base.eq_s_b("u")))
                {
                    break lab21;
                }
                golab22: while(true)
                {
                    var /** number */ v_10 = base.limit - base.cursor;
                    lab23: {
                        if (!(base.in_grouping_b(g_vowel5, 111, 117)))
                        {
                            break lab23;
                        }
                        base.cursor = base.limit - v_10;
                        break golab22;
                    }
                    base.cursor = base.limit - v_10;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab21;
                    }
                    base.cursor--;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            if (!(base.eq_s_b("\u00FC")))
            {
                return false;
            }
            golab24: while(true)
            {
                var /** number */ v_11 = base.limit - base.cursor;
                lab25: {
                    if (!(base.in_grouping_b(g_vowel6, 246, 252)))
                    {
                        break lab25;
                    }
                    base.cursor = base.limit - v_11;
                    break golab24;
                }
                base.cursor = base.limit - v_11;
                if (base.cursor <= base.limit_backward)
                {
                    return false;
                }
                base.cursor--;
            }
        }
        base.cursor = base.limit - v_1;
        return true;
    };

    /** @return {boolean} */
    function r_mark_suffix_with_optional_n_consonant() {
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.eq_s_b("n")))
                {
                    break lab1;
                }
                var /** number */ v_2 = base.limit - base.cursor;
                if (!(base.in_grouping_b(g_vowel, 97, 305)))
                {
                    break lab1;
                }
                base.cursor = base.limit - v_2;
                break lab0;
            }
            base.cursor = base.limit - v_1;
            {
                var /** number */ v_3 = base.limit - base.cursor;
                lab2: {
                    var /** number */ v_4 = base.limit - base.cursor;
                    if (!(base.eq_s_b("n")))
                    {
                        break lab2;
                    }
                    base.cursor = base.limit - v_4;
                    return false;
                }
                base.cursor = base.limit - v_3;
            }
            var /** number */ v_5 = base.limit - base.cursor;
            if (base.cursor <= base.limit_backward)
            {
                return false;
            }
            base.cursor--;
            if (!(base.in_grouping_b(g_vowel, 97, 305)))
            {
                return false;
            }
            base.cursor = base.limit - v_5;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_suffix_with_optional_s_consonant() {
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.eq_s_b("s")))
                {
                    break lab1;
                }
                var /** number */ v_2 = base.limit - base.cursor;
                if (!(base.in_grouping_b(g_vowel, 97, 305)))
                {
                    break lab1;
                }
                base.cursor = base.limit - v_2;
                break lab0;
            }
            base.cursor = base.limit - v_1;
            {
                var /** number */ v_3 = base.limit - base.cursor;
                lab2: {
                    var /** number */ v_4 = base.limit - base.cursor;
                    if (!(base.eq_s_b("s")))
                    {
                        break lab2;
                    }
                    base.cursor = base.limit - v_4;
                    return false;
                }
                base.cursor = base.limit - v_3;
            }
            var /** number */ v_5 = base.limit - base.cursor;
            if (base.cursor <= base.limit_backward)
            {
                return false;
            }
            base.cursor--;
            if (!(base.in_grouping_b(g_vowel, 97, 305)))
            {
                return false;
            }
            base.cursor = base.limit - v_5;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_suffix_with_optional_y_consonant() {
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.eq_s_b("y")))
                {
                    break lab1;
                }
                var /** number */ v_2 = base.limit - base.cursor;
                if (!(base.in_grouping_b(g_vowel, 97, 305)))
                {
                    break lab1;
                }
                base.cursor = base.limit - v_2;
                break lab0;
            }
            base.cursor = base.limit - v_1;
            {
                var /** number */ v_3 = base.limit - base.cursor;
                lab2: {
                    var /** number */ v_4 = base.limit - base.cursor;
                    if (!(base.eq_s_b("y")))
                    {
                        break lab2;
                    }
                    base.cursor = base.limit - v_4;
                    return false;
                }
                base.cursor = base.limit - v_3;
            }
            var /** number */ v_5 = base.limit - base.cursor;
            if (base.cursor <= base.limit_backward)
            {
                return false;
            }
            base.cursor--;
            if (!(base.in_grouping_b(g_vowel, 97, 305)))
            {
                return false;
            }
            base.cursor = base.limit - v_5;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_suffix_with_optional_U_vowel() {
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!(base.in_grouping_b(g_U, 105, 305)))
                {
                    break lab1;
                }
                var /** number */ v_2 = base.limit - base.cursor;
                if (!(base.out_grouping_b(g_vowel, 97, 305)))
                {
                    break lab1;
                }
                base.cursor = base.limit - v_2;
                break lab0;
            }
            base.cursor = base.limit - v_1;
            {
                var /** number */ v_3 = base.limit - base.cursor;
                lab2: {
                    var /** number */ v_4 = base.limit - base.cursor;
                    if (!(base.in_grouping_b(g_U, 105, 305)))
                    {
                        break lab2;
                    }
                    base.cursor = base.limit - v_4;
                    return false;
                }
                base.cursor = base.limit - v_3;
            }
            var /** number */ v_5 = base.limit - base.cursor;
            if (base.cursor <= base.limit_backward)
            {
                return false;
            }
            base.cursor--;
            if (!(base.out_grouping_b(g_vowel, 97, 305)))
            {
                return false;
            }
            base.cursor = base.limit - v_5;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_possessives() {
        if (base.find_among_b(a_0) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_U_vowel())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_sU() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (!(base.in_grouping_b(g_U, 105, 305)))
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_s_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_lArI() {
        if (base.find_among_b(a_1) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_yU() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (!(base.in_grouping_b(g_U, 105, 305)))
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_nU() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_2) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_nUn() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_3) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_n_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_yA() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_4) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_nA() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_5) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_DA() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_6) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ndA() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_7) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_DAn() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_8) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ndAn() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_9) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ylA() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_10) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ki() {
        if (!(base.eq_s_b("ki")))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ncA() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_11) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_n_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_yUm() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_12) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_sUn() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_13) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_yUz() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_14) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_sUnUz() {
        if (base.find_among_b(a_15) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_lAr() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_16) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_nUz() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_17) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_DUr() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_18) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_cAsInA() {
        if (base.find_among_b(a_19) == 0)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_yDU() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_20) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ysA() {
        if (base.find_among_b(a_21) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_ymUs_() {
        if (!r_check_vowel_harmony())
        {
            return false;
        }
        if (base.find_among_b(a_22) == 0)
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_yken() {
        if (!(base.eq_s_b("ken")))
        {
            return false;
        }
        if (!r_mark_suffix_with_optional_y_consonant())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_stem_nominal_verb_suffixes() {
        base.ket = base.cursor;
        B_continue_stemming_noun_suffixes = true;
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                lab2: {
                    var /** number */ v_2 = base.limit - base.cursor;
                    lab3: {
                        if (!r_mark_ymUs_())
                        {
                            break lab3;
                        }
                        break lab2;
                    }
                    base.cursor = base.limit - v_2;
                    lab4: {
                        if (!r_mark_yDU())
                        {
                            break lab4;
                        }
                        break lab2;
                    }
                    base.cursor = base.limit - v_2;
                    lab5: {
                        if (!r_mark_ysA())
                        {
                            break lab5;
                        }
                        break lab2;
                    }
                    base.cursor = base.limit - v_2;
                    if (!r_mark_yken())
                    {
                        break lab1;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab6: {
                if (!r_mark_cAsInA())
                {
                    break lab6;
                }
                lab7: {
                    var /** number */ v_3 = base.limit - base.cursor;
                    lab8: {
                        if (!r_mark_sUnUz())
                        {
                            break lab8;
                        }
                        break lab7;
                    }
                    base.cursor = base.limit - v_3;
                    lab9: {
                        if (!r_mark_lAr())
                        {
                            break lab9;
                        }
                        break lab7;
                    }
                    base.cursor = base.limit - v_3;
                    lab10: {
                        if (!r_mark_yUm())
                        {
                            break lab10;
                        }
                        break lab7;
                    }
                    base.cursor = base.limit - v_3;
                    lab11: {
                        if (!r_mark_sUn())
                        {
                            break lab11;
                        }
                        break lab7;
                    }
                    base.cursor = base.limit - v_3;
                    lab12: {
                        if (!r_mark_yUz())
                        {
                            break lab12;
                        }
                        break lab7;
                    }
                    base.cursor = base.limit - v_3;
                }
                if (!r_mark_ymUs_())
                {
                    break lab6;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab13: {
                if (!r_mark_lAr())
                {
                    break lab13;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_4 = base.limit - base.cursor;
                lab14: {
                    base.ket = base.cursor;
                    lab15: {
                        var /** number */ v_5 = base.limit - base.cursor;
                        lab16: {
                            if (!r_mark_DUr())
                            {
                                break lab16;
                            }
                            break lab15;
                        }
                        base.cursor = base.limit - v_5;
                        lab17: {
                            if (!r_mark_yDU())
                            {
                                break lab17;
                            }
                            break lab15;
                        }
                        base.cursor = base.limit - v_5;
                        lab18: {
                            if (!r_mark_ysA())
                            {
                                break lab18;
                            }
                            break lab15;
                        }
                        base.cursor = base.limit - v_5;
                        if (!r_mark_ymUs_())
                        {
                            base.cursor = base.limit - v_4;
                            break lab14;
                        }
                    }
                }
                B_continue_stemming_noun_suffixes = false;
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab19: {
                if (!r_mark_nUz())
                {
                    break lab19;
                }
                lab20: {
                    var /** number */ v_6 = base.limit - base.cursor;
                    lab21: {
                        if (!r_mark_yDU())
                        {
                            break lab21;
                        }
                        break lab20;
                    }
                    base.cursor = base.limit - v_6;
                    if (!r_mark_ysA())
                    {
                        break lab19;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab22: {
                lab23: {
                    var /** number */ v_7 = base.limit - base.cursor;
                    lab24: {
                        if (!r_mark_sUnUz())
                        {
                            break lab24;
                        }
                        break lab23;
                    }
                    base.cursor = base.limit - v_7;
                    lab25: {
                        if (!r_mark_yUz())
                        {
                            break lab25;
                        }
                        break lab23;
                    }
                    base.cursor = base.limit - v_7;
                    lab26: {
                        if (!r_mark_sUn())
                        {
                            break lab26;
                        }
                        break lab23;
                    }
                    base.cursor = base.limit - v_7;
                    if (!r_mark_yUm())
                    {
                        break lab22;
                    }
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_8 = base.limit - base.cursor;
                lab27: {
                    base.ket = base.cursor;
                    if (!r_mark_ymUs_())
                    {
                        base.cursor = base.limit - v_8;
                        break lab27;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            if (!r_mark_DUr())
            {
                return false;
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            var /** number */ v_9 = base.limit - base.cursor;
            lab28: {
                base.ket = base.cursor;
                lab29: {
                    var /** number */ v_10 = base.limit - base.cursor;
                    lab30: {
                        if (!r_mark_sUnUz())
                        {
                            break lab30;
                        }
                        break lab29;
                    }
                    base.cursor = base.limit - v_10;
                    lab31: {
                        if (!r_mark_lAr())
                        {
                            break lab31;
                        }
                        break lab29;
                    }
                    base.cursor = base.limit - v_10;
                    lab32: {
                        if (!r_mark_yUm())
                        {
                            break lab32;
                        }
                        break lab29;
                    }
                    base.cursor = base.limit - v_10;
                    lab33: {
                        if (!r_mark_sUn())
                        {
                            break lab33;
                        }
                        break lab29;
                    }
                    base.cursor = base.limit - v_10;
                    lab34: {
                        if (!r_mark_yUz())
                        {
                            break lab34;
                        }
                        break lab29;
                    }
                    base.cursor = base.limit - v_10;
                }
                if (!r_mark_ymUs_())
                {
                    base.cursor = base.limit - v_9;
                    break lab28;
                }
            }
        }
        base.bra = base.cursor;
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_stem_suffix_chain_before_ki() {
        base.ket = base.cursor;
        if (!r_mark_ki())
        {
            return false;
        }
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                if (!r_mark_DA())
                {
                    break lab1;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_2 = base.limit - base.cursor;
                lab2: {
                    base.ket = base.cursor;
                    lab3: {
                        var /** number */ v_3 = base.limit - base.cursor;
                        lab4: {
                            if (!r_mark_lAr())
                            {
                                break lab4;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_4 = base.limit - base.cursor;
                            lab5: {
                                if (!r_stem_suffix_chain_before_ki())
                                {
                                    base.cursor = base.limit - v_4;
                                    break lab5;
                                }
                            }
                            break lab3;
                        }
                        base.cursor = base.limit - v_3;
                        if (!r_mark_possessives())
                        {
                            base.cursor = base.limit - v_2;
                            break lab2;
                        }
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        var /** number */ v_5 = base.limit - base.cursor;
                        lab6: {
                            base.ket = base.cursor;
                            if (!r_mark_lAr())
                            {
                                base.cursor = base.limit - v_5;
                                break lab6;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            if (!r_stem_suffix_chain_before_ki())
                            {
                                base.cursor = base.limit - v_5;
                                break lab6;
                            }
                        }
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab7: {
                if (!r_mark_nUn())
                {
                    break lab7;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_6 = base.limit - base.cursor;
                lab8: {
                    base.ket = base.cursor;
                    lab9: {
                        var /** number */ v_7 = base.limit - base.cursor;
                        lab10: {
                            if (!r_mark_lArI())
                            {
                                break lab10;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break lab9;
                        }
                        base.cursor = base.limit - v_7;
                        lab11: {
                            base.ket = base.cursor;
                            lab12: {
                                var /** number */ v_8 = base.limit - base.cursor;
                                lab13: {
                                    if (!r_mark_possessives())
                                    {
                                        break lab13;
                                    }
                                    break lab12;
                                }
                                base.cursor = base.limit - v_8;
                                if (!r_mark_sU())
                                {
                                    break lab11;
                                }
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_9 = base.limit - base.cursor;
                            lab14: {
                                base.ket = base.cursor;
                                if (!r_mark_lAr())
                                {
                                    base.cursor = base.limit - v_9;
                                    break lab14;
                                }
                                base.bra = base.cursor;
                                if (!base.slice_del())
                                {
                                    return false;
                                }
                                if (!r_stem_suffix_chain_before_ki())
                                {
                                    base.cursor = base.limit - v_9;
                                    break lab14;
                                }
                            }
                            break lab9;
                        }
                        base.cursor = base.limit - v_7;
                        if (!r_stem_suffix_chain_before_ki())
                        {
                            base.cursor = base.limit - v_6;
                            break lab8;
                        }
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            if (!r_mark_ndA())
            {
                return false;
            }
            lab15: {
                var /** number */ v_10 = base.limit - base.cursor;
                lab16: {
                    if (!r_mark_lArI())
                    {
                        break lab16;
                    }
                    base.bra = base.cursor;
                    if (!base.slice_del())
                    {
                        return false;
                    }
                    break lab15;
                }
                base.cursor = base.limit - v_10;
                lab17: {
                    if (!r_mark_sU())
                    {
                        break lab17;
                    }
                    base.bra = base.cursor;
                    if (!base.slice_del())
                    {
                        return false;
                    }
                    var /** number */ v_11 = base.limit - base.cursor;
                    lab18: {
                        base.ket = base.cursor;
                        if (!r_mark_lAr())
                        {
                            base.cursor = base.limit - v_11;
                            break lab18;
                        }
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        if (!r_stem_suffix_chain_before_ki())
                        {
                            base.cursor = base.limit - v_11;
                            break lab18;
                        }
                    }
                    break lab15;
                }
                base.cursor = base.limit - v_10;
                if (!r_stem_suffix_chain_before_ki())
                {
                    return false;
                }
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_stem_noun_suffixes() {
        lab0: {
            var /** number */ v_1 = base.limit - base.cursor;
            lab1: {
                base.ket = base.cursor;
                if (!r_mark_lAr())
                {
                    break lab1;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_2 = base.limit - base.cursor;
                lab2: {
                    if (!r_stem_suffix_chain_before_ki())
                    {
                        base.cursor = base.limit - v_2;
                        break lab2;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab3: {
                base.ket = base.cursor;
                if (!r_mark_ncA())
                {
                    break lab3;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_3 = base.limit - base.cursor;
                lab4: {
                    lab5: {
                        var /** number */ v_4 = base.limit - base.cursor;
                        lab6: {
                            base.ket = base.cursor;
                            if (!r_mark_lArI())
                            {
                                break lab6;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            break lab5;
                        }
                        base.cursor = base.limit - v_4;
                        lab7: {
                            base.ket = base.cursor;
                            lab8: {
                                var /** number */ v_5 = base.limit - base.cursor;
                                lab9: {
                                    if (!r_mark_possessives())
                                    {
                                        break lab9;
                                    }
                                    break lab8;
                                }
                                base.cursor = base.limit - v_5;
                                if (!r_mark_sU())
                                {
                                    break lab7;
                                }
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_6 = base.limit - base.cursor;
                            lab10: {
                                base.ket = base.cursor;
                                if (!r_mark_lAr())
                                {
                                    base.cursor = base.limit - v_6;
                                    break lab10;
                                }
                                base.bra = base.cursor;
                                if (!base.slice_del())
                                {
                                    return false;
                                }
                                if (!r_stem_suffix_chain_before_ki())
                                {
                                    base.cursor = base.limit - v_6;
                                    break lab10;
                                }
                            }
                            break lab5;
                        }
                        base.cursor = base.limit - v_4;
                        base.ket = base.cursor;
                        if (!r_mark_lAr())
                        {
                            base.cursor = base.limit - v_3;
                            break lab4;
                        }
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        if (!r_stem_suffix_chain_before_ki())
                        {
                            base.cursor = base.limit - v_3;
                            break lab4;
                        }
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab11: {
                base.ket = base.cursor;
                lab12: {
                    var /** number */ v_7 = base.limit - base.cursor;
                    lab13: {
                        if (!r_mark_ndA())
                        {
                            break lab13;
                        }
                        break lab12;
                    }
                    base.cursor = base.limit - v_7;
                    if (!r_mark_nA())
                    {
                        break lab11;
                    }
                }
                lab14: {
                    var /** number */ v_8 = base.limit - base.cursor;
                    lab15: {
                        if (!r_mark_lArI())
                        {
                            break lab15;
                        }
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        break lab14;
                    }
                    base.cursor = base.limit - v_8;
                    lab16: {
                        if (!r_mark_sU())
                        {
                            break lab16;
                        }
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        var /** number */ v_9 = base.limit - base.cursor;
                        lab17: {
                            base.ket = base.cursor;
                            if (!r_mark_lAr())
                            {
                                base.cursor = base.limit - v_9;
                                break lab17;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            if (!r_stem_suffix_chain_before_ki())
                            {
                                base.cursor = base.limit - v_9;
                                break lab17;
                            }
                        }
                        break lab14;
                    }
                    base.cursor = base.limit - v_8;
                    if (!r_stem_suffix_chain_before_ki())
                    {
                        break lab11;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab18: {
                base.ket = base.cursor;
                lab19: {
                    var /** number */ v_10 = base.limit - base.cursor;
                    lab20: {
                        if (!r_mark_ndAn())
                        {
                            break lab20;
                        }
                        break lab19;
                    }
                    base.cursor = base.limit - v_10;
                    if (!r_mark_nU())
                    {
                        break lab18;
                    }
                }
                lab21: {
                    var /** number */ v_11 = base.limit - base.cursor;
                    lab22: {
                        if (!r_mark_sU())
                        {
                            break lab22;
                        }
                        base.bra = base.cursor;
                        if (!base.slice_del())
                        {
                            return false;
                        }
                        var /** number */ v_12 = base.limit - base.cursor;
                        lab23: {
                            base.ket = base.cursor;
                            if (!r_mark_lAr())
                            {
                                base.cursor = base.limit - v_12;
                                break lab23;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            if (!r_stem_suffix_chain_before_ki())
                            {
                                base.cursor = base.limit - v_12;
                                break lab23;
                            }
                        }
                        break lab21;
                    }
                    base.cursor = base.limit - v_11;
                    if (!r_mark_lArI())
                    {
                        break lab18;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab24: {
                base.ket = base.cursor;
                if (!r_mark_DAn())
                {
                    break lab24;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_13 = base.limit - base.cursor;
                lab25: {
                    base.ket = base.cursor;
                    lab26: {
                        var /** number */ v_14 = base.limit - base.cursor;
                        lab27: {
                            if (!r_mark_possessives())
                            {
                                break lab27;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_15 = base.limit - base.cursor;
                            lab28: {
                                base.ket = base.cursor;
                                if (!r_mark_lAr())
                                {
                                    base.cursor = base.limit - v_15;
                                    break lab28;
                                }
                                base.bra = base.cursor;
                                if (!base.slice_del())
                                {
                                    return false;
                                }
                                if (!r_stem_suffix_chain_before_ki())
                                {
                                    base.cursor = base.limit - v_15;
                                    break lab28;
                                }
                            }
                            break lab26;
                        }
                        base.cursor = base.limit - v_14;
                        lab29: {
                            if (!r_mark_lAr())
                            {
                                break lab29;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_16 = base.limit - base.cursor;
                            lab30: {
                                if (!r_stem_suffix_chain_before_ki())
                                {
                                    base.cursor = base.limit - v_16;
                                    break lab30;
                                }
                            }
                            break lab26;
                        }
                        base.cursor = base.limit - v_14;
                        if (!r_stem_suffix_chain_before_ki())
                        {
                            base.cursor = base.limit - v_13;
                            break lab25;
                        }
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab31: {
                base.ket = base.cursor;
                lab32: {
                    var /** number */ v_17 = base.limit - base.cursor;
                    lab33: {
                        if (!r_mark_nUn())
                        {
                            break lab33;
                        }
                        break lab32;
                    }
                    base.cursor = base.limit - v_17;
                    if (!r_mark_ylA())
                    {
                        break lab31;
                    }
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_18 = base.limit - base.cursor;
                lab34: {
                    lab35: {
                        var /** number */ v_19 = base.limit - base.cursor;
                        lab36: {
                            base.ket = base.cursor;
                            if (!r_mark_lAr())
                            {
                                break lab36;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            if (!r_stem_suffix_chain_before_ki())
                            {
                                break lab36;
                            }
                            break lab35;
                        }
                        base.cursor = base.limit - v_19;
                        lab37: {
                            base.ket = base.cursor;
                            lab38: {
                                var /** number */ v_20 = base.limit - base.cursor;
                                lab39: {
                                    if (!r_mark_possessives())
                                    {
                                        break lab39;
                                    }
                                    break lab38;
                                }
                                base.cursor = base.limit - v_20;
                                if (!r_mark_sU())
                                {
                                    break lab37;
                                }
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_21 = base.limit - base.cursor;
                            lab40: {
                                base.ket = base.cursor;
                                if (!r_mark_lAr())
                                {
                                    base.cursor = base.limit - v_21;
                                    break lab40;
                                }
                                base.bra = base.cursor;
                                if (!base.slice_del())
                                {
                                    return false;
                                }
                                if (!r_stem_suffix_chain_before_ki())
                                {
                                    base.cursor = base.limit - v_21;
                                    break lab40;
                                }
                            }
                            break lab35;
                        }
                        base.cursor = base.limit - v_19;
                        if (!r_stem_suffix_chain_before_ki())
                        {
                            base.cursor = base.limit - v_18;
                            break lab34;
                        }
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab41: {
                base.ket = base.cursor;
                if (!r_mark_lArI())
                {
                    break lab41;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab42: {
                if (!r_stem_suffix_chain_before_ki())
                {
                    break lab42;
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            lab43: {
                base.ket = base.cursor;
                lab44: {
                    var /** number */ v_22 = base.limit - base.cursor;
                    lab45: {
                        if (!r_mark_DA())
                        {
                            break lab45;
                        }
                        break lab44;
                    }
                    base.cursor = base.limit - v_22;
                    lab46: {
                        if (!r_mark_yU())
                        {
                            break lab46;
                        }
                        break lab44;
                    }
                    base.cursor = base.limit - v_22;
                    if (!r_mark_yA())
                    {
                        break lab43;
                    }
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                var /** number */ v_23 = base.limit - base.cursor;
                lab47: {
                    base.ket = base.cursor;
                    lab48: {
                        var /** number */ v_24 = base.limit - base.cursor;
                        lab49: {
                            if (!r_mark_possessives())
                            {
                                break lab49;
                            }
                            base.bra = base.cursor;
                            if (!base.slice_del())
                            {
                                return false;
                            }
                            var /** number */ v_25 = base.limit - base.cursor;
                            lab50: {
                                base.ket = base.cursor;
                                if (!r_mark_lAr())
                                {
                                    base.cursor = base.limit - v_25;
                                    break lab50;
                                }
                            }
                            break lab48;
                        }
                        base.cursor = base.limit - v_24;
                        if (!r_mark_lAr())
                        {
                            base.cursor = base.limit - v_23;
                            break lab47;
                        }
                    }
                    base.bra = base.cursor;
                    if (!base.slice_del())
                    {
                        return false;
                    }
                    base.ket = base.cursor;
                    if (!r_stem_suffix_chain_before_ki())
                    {
                        base.cursor = base.limit - v_23;
                        break lab47;
                    }
                }
                break lab0;
            }
            base.cursor = base.limit - v_1;
            base.ket = base.cursor;
            lab51: {
                var /** number */ v_26 = base.limit - base.cursor;
                lab52: {
                    if (!r_mark_possessives())
                    {
                        break lab52;
                    }
                    break lab51;
                }
                base.cursor = base.limit - v_26;
                if (!r_mark_sU())
                {
                    return false;
                }
            }
            base.bra = base.cursor;
            if (!base.slice_del())
            {
                return false;
            }
            var /** number */ v_27 = base.limit - base.cursor;
            lab53: {
                base.ket = base.cursor;
                if (!r_mark_lAr())
                {
                    base.cursor = base.limit - v_27;
                    break lab53;
                }
                base.bra = base.cursor;
                if (!base.slice_del())
                {
                    return false;
                }
                if (!r_stem_suffix_chain_before_ki())
                {
                    base.cursor = base.limit - v_27;
                    break lab53;
                }
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_post_process_last_consonants() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_23);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                if (!base.slice_from("p"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("\u00E7"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("t"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("k"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_append_U_to_stems_ending_with_d_or_g() {
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            var /** number */ v_2 = base.limit - base.cursor;
            lab1: {
                if (!(base.eq_s_b("d")))
                {
                    break lab1;
                }
                break lab0;
            }
            base.cursor = base.limit - v_2;
            if (!(base.eq_s_b("g")))
            {
                return false;
            }
        }
        base.cursor = base.limit - v_1;
        lab2: {
            var /** number */ v_3 = base.limit - base.cursor;
            lab3: {
                var /** number */ v_4 = base.limit - base.cursor;
                golab4: while(true)
                {
                    var /** number */ v_5 = base.limit - base.cursor;
                    lab5: {
                        if (!(base.in_grouping_b(g_vowel, 97, 305)))
                        {
                            break lab5;
                        }
                        base.cursor = base.limit - v_5;
                        break golab4;
                    }
                    base.cursor = base.limit - v_5;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab3;
                    }
                    base.cursor--;
                }
                lab6: {
                    var /** number */ v_6 = base.limit - base.cursor;
                    lab7: {
                        if (!(base.eq_s_b("a")))
                        {
                            break lab7;
                        }
                        break lab6;
                    }
                    base.cursor = base.limit - v_6;
                    if (!(base.eq_s_b("\u0131")))
                    {
                        break lab3;
                    }
                }
                base.cursor = base.limit - v_4;
                {
                    var /** number */ c1 = base.cursor;
                    base.insert(base.cursor, base.cursor, "\u0131");
                    base.cursor = c1;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab8: {
                var /** number */ v_7 = base.limit - base.cursor;
                golab9: while(true)
                {
                    var /** number */ v_8 = base.limit - base.cursor;
                    lab10: {
                        if (!(base.in_grouping_b(g_vowel, 97, 305)))
                        {
                            break lab10;
                        }
                        base.cursor = base.limit - v_8;
                        break golab9;
                    }
                    base.cursor = base.limit - v_8;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab8;
                    }
                    base.cursor--;
                }
                lab11: {
                    var /** number */ v_9 = base.limit - base.cursor;
                    lab12: {
                        if (!(base.eq_s_b("e")))
                        {
                            break lab12;
                        }
                        break lab11;
                    }
                    base.cursor = base.limit - v_9;
                    if (!(base.eq_s_b("i")))
                    {
                        break lab8;
                    }
                }
                base.cursor = base.limit - v_7;
                {
                    var /** number */ c2 = base.cursor;
                    base.insert(base.cursor, base.cursor, "i");
                    base.cursor = c2;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            lab13: {
                var /** number */ v_10 = base.limit - base.cursor;
                golab14: while(true)
                {
                    var /** number */ v_11 = base.limit - base.cursor;
                    lab15: {
                        if (!(base.in_grouping_b(g_vowel, 97, 305)))
                        {
                            break lab15;
                        }
                        base.cursor = base.limit - v_11;
                        break golab14;
                    }
                    base.cursor = base.limit - v_11;
                    if (base.cursor <= base.limit_backward)
                    {
                        break lab13;
                    }
                    base.cursor--;
                }
                lab16: {
                    var /** number */ v_12 = base.limit - base.cursor;
                    lab17: {
                        if (!(base.eq_s_b("o")))
                        {
                            break lab17;
                        }
                        break lab16;
                    }
                    base.cursor = base.limit - v_12;
                    if (!(base.eq_s_b("u")))
                    {
                        break lab13;
                    }
                }
                base.cursor = base.limit - v_10;
                {
                    var /** number */ c3 = base.cursor;
                    base.insert(base.cursor, base.cursor, "u");
                    base.cursor = c3;
                }
                break lab2;
            }
            base.cursor = base.limit - v_3;
            var /** number */ v_13 = base.limit - base.cursor;
            golab18: while(true)
            {
                var /** number */ v_14 = base.limit - base.cursor;
                lab19: {
                    if (!(base.in_grouping_b(g_vowel, 97, 305)))
                    {
                        break lab19;
                    }
                    base.cursor = base.limit - v_14;
                    break golab18;
                }
                base.cursor = base.limit - v_14;
                if (base.cursor <= base.limit_backward)
                {
                    return false;
                }
                base.cursor--;
            }
            lab20: {
                var /** number */ v_15 = base.limit - base.cursor;
                lab21: {
                    if (!(base.eq_s_b("\u00F6")))
                    {
                        break lab21;
                    }
                    break lab20;
                }
                base.cursor = base.limit - v_15;
                if (!(base.eq_s_b("\u00FC")))
                {
                    return false;
                }
            }
            base.cursor = base.limit - v_13;
            {
                var /** number */ c4 = base.cursor;
                base.insert(base.cursor, base.cursor, "\u00FC");
                base.cursor = c4;
            }
        }
        return true;
    };

    /** @return {boolean} */
    function r_is_reserved_word() {
        if (!(base.eq_s_b("ad")))
        {
            return false;
        }
        var /** number */ v_1 = base.limit - base.cursor;
        lab0: {
            if (!(base.eq_s_b("soy")))
            {
                base.cursor = base.limit - v_1;
                break lab0;
            }
        }
        if (base.cursor > base.limit_backward)
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_more_than_one_syllable_word() {
        var /** number */ v_1 = base.cursor;
        {
            var v_2 = 2;
            while(true)
            {
                var /** number */ v_3 = base.cursor;
                lab0: {
                    golab1: while(true)
                    {
                        lab2: {
                            if (!(base.in_grouping(g_vowel, 97, 305)))
                            {
                                break lab2;
                            }
                            break golab1;
                        }
                        if (base.cursor >= base.limit)
                        {
                            break lab0;
                        }
                        base.cursor++;
                    }
                    v_2--;
                    continue;
                }
                base.cursor = v_3;
                break;
            }
            if (v_2 > 0)
            {
                return false;
            }
        }
        base.cursor = v_1;
        return true;
    };

    /** @return {boolean} */
    function r_postlude() {
        base.limit_backward = base.cursor; base.cursor = base.limit;
        {
            var /** number */ v_1 = base.limit - base.cursor;
            lab0: {
                if (!r_is_reserved_word())
                {
                    break lab0;
                }
                return false;
            }
            base.cursor = base.limit - v_1;
        }
        var /** number */ v_2 = base.limit - base.cursor;
        r_append_U_to_stems_ending_with_d_or_g();
        base.cursor = base.limit - v_2;
        var /** number */ v_3 = base.limit - base.cursor;
        r_post_process_last_consonants();
        base.cursor = base.limit - v_3;
        base.cursor = base.limit_backward;
        return true;
    };

    this.stem = /** @return {boolean} */ function() {
        if (!r_more_than_one_syllable_word())
        {
            return false;
        }
        base.limit_backward = base.cursor; base.cursor = base.limit;
        var /** number */ v_1 = base.limit - base.cursor;
        r_stem_nominal_verb_suffixes();
        base.cursor = base.limit - v_1;
        if (!B_continue_stemming_noun_suffixes)
        {
            return false;
        }
        var /** number */ v_2 = base.limit - base.cursor;
        r_stem_noun_suffixes();
        base.cursor = base.limit - v_2;
        base.cursor = base.limit_backward;
        if (!r_postlude())
        {
            return false;
        }
        return true;
    };

    /**@return{string}*/
    this['stemWord'] = function(/**string*/word) {
        base.setCurrent(word);
        this.stem();
        return base.getCurrent();
    };
};

Stemmer = TurkishStemmer;
