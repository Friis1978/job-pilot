-- Half of all saved jobs carry only a truncated aggregator snippet (Careerjet
-- returns ~250 characters, and the page behind it is bot-protected), yet they
-- were scored as confidently as jobs with a full posting — 45 of them above 50,
-- one at 91. The UI needs to mark those jobs, and the jobs list cannot afford to
-- select full_post_text just to measure it.
--
-- A STORED generated column keeps the measure next to the data, applies to every
-- existing row immediately, and stays correct when the text is later updated.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS description_word_count integer
  GENERATED ALWAYS AS (
    coalesce(
      array_length(
        regexp_split_to_array(
          nullif(trim(coalesce(full_post_text, about_role, '')), ''),
          '\s+'
        ),
        1
      ),
      0
    )
  ) STORED;

COMMENT ON COLUMN public.jobs.description_word_count IS
  'Words in the scored description. Under 100 means the posting is a snippet and its match_score is capped — see LOW_INFO_WORD_COUNT in lib/utils.ts.';
