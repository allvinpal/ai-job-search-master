# Naukri.com URL Reference

## Search URLs

### Descriptive URL pattern (SEO-friendly)
```
https://www.naukri.com/{keyword}-jobs-in-{location}
https://www.naukri.com/{keyword}-jobs-in-{location}-{page}
```

Examples:
- `https://www.naukri.com/data-engineer-jobs-in-bangalore`
- `https://www.naukri.com/python-developer-jobs-in-hyderabad-2` (page 2)
- `https://www.naukri.com/software-engineer-jobs` (no location filter)

### Query parameter pattern
```
https://www.naukri.com/jobs-in-{location}?k={keyword}&experience={min}-{max}&jobAge={days}&wfhType={type}
```

Parameters:
- `k` — keyword (URL-encoded)
- `l` — location
- `experience` — range like `3-5`, `0-1`, `5-100`
- `jobAge` — `1` (today), `3` (last 3 days), `7`, `15`, `30`
- `wfhType` — `2` (work from home / remote), `3` (hybrid), `1` (work from office)
- `cityTypeGid` — city type ID

## Job Detail URLs

```
https://www.naukri.com/job-listings-{slug}
https://www.naukri.com/job-listings-{title}-{company}-{location}-{id}
```

Examples:
- `https://www.naukri.com/job-listings-senior-data-engineer-abc-corp-bangalore-karnataka-3-to-5-years-...`

## Internal API (reverse-engineered, not officially supported)

```
https://www.naukri.com/jobapi/v3/search?noOfResults=20&urlType=search_by_keyword&searchType=adv&keyword={keyword}&location={location}&pageNo={page}&experience={min}&jobAge={days}&wfhType={type}
```

Headers needed:
- `appid: 109`
- `systemid: Naukri`
- Standard browser User-Agent

Response: JSON with `jobDetails` array.

## Notes

- Naukri uses heavy JavaScript rendering; public HTML pages have job cards
  in `<article>` elements with `class="jobTuple"` or similar.
- The internal `/jobapi/v3/search` endpoint returns clean JSON but requires
  specific headers and may change without notice.
- Always check `https://www.naukri.com/robots.txt` for crawl policies.
