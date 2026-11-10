# Research gaps: sleep and procedural memory in older adults

Run `2026-11-10T20-56-26-834Z` · 2026-11-10 · rloop v0.1

## Summary

- Papers: 100 fetched (asked for 100) from pubmed (124 available), europepmc (69 available), openalex (3249 available), clinicaltrials (33 available)
- Claims extracted: 114; quotes verified against abstracts: 114
- Gaps proposed: 12; killed by the disprover: 0; survived: 12
- Disprover bar per surviving gap: ≥ 10 searches across ≥ 2 databases (from the search log)
- Citations checked by code: 76, unresolved: 0

## Surviving gaps, ranked

### 1. In healthy adults aged 60-80, does overnight phase-locked closed-loop acoustic stimulation of slow oscillations, compared with sham, increase SO-spindle coupling and overnight offline gains on a finger-tapping motor sequence task, and does the size of the gain scale with the number of stimuli delivered?

`g01` · signal: narrow-coverage · score 192 (novelty 3, importance 4, tractability 4, evidence gap 4)

The only closed-loop acoustic stimulation data with a motor outcome come from one afternoon-nap study in healthy (non-older) adults: stimulation raised coupled SO-spindle events, gave no group effect on memory, but showed a dose-response with stimulation rate (c0083-c0085). In older adults, the spindle-targeted interventions tried so far (spindle-tACS, TMR) did not improve motor consolidation, and TMR even lowered spindle density (c0022, c0027, c0029, c0052). Coupling is reported to be reduced with age (c0008). No study in this set applies whole-night CLAS to older adults with a procedural outcome.

**Evidence it rests on**

- closed-loop acoustic stimulation *increases* spindle-slow oscillation coupling (experiment, n=20, healthy adults, afternoon nap): "Auditory stimulation evoked more coupled SO-spindle events than detection only in a fronto-central cluster of electrodes" Evaluating Closed-loop Auditory Stimulation during Sleep as an Intervention to Improve Memory Consolidation (4149) (2021) `doi:10.1212/wnl.96.15_supplement.4149`
- closed-loop acoustic stimulation *no-effect* motor memory consolidation (experiment, n=20, healthy adults, afternoon nap): "there was no significant effect of condition on memory" Evaluating Closed-loop Auditory Stimulation during Sleep as an Intervention to Improve Memory Consolidation (4149) (2021) `doi:10.1212/wnl.96.15_supplement.4149`
- closed-loop acoustic stimulation *associated* motor memory consolidation (experiment, n=20, healthy adults, afternoon nap): "the higher the stimulation rate (#/min), the greater the memory improvement in the stimulation" Evaluating Closed-loop Auditory Stimulation during Sleep as an Intervention to Improve Memory Consolidation (4149) (2021) `doi:10.1212/wnl.96.15_supplement.4149`
- spindle-slow oscillation coupling *associated* motor memory consolidation (experiment, n=20, healthy adults, afternoon nap): "coupled SO-spindle density (#/min) in a centro-parietal cluster significantly correlated with memory improvement" Evaluating Closed-loop Auditory Stimulation during Sleep as an Intervention to Improve Memory Consolidation (4149) (2021) `doi:10.1212/wnl.96.15_supplement.4149`
- aging *decreases* spindle-slow wave coupling (experiment, n=70, young vs older adults, 90-min nap): "the percentage of coupled spindles was lower in older compared to younger individuals from control to testing sessions" Spindle-slow wave coupling and problem-solving skills: impact of age. (2024) `doi:10.1093/sleep/zsae072`
- transcranial alternating current stimulation *no-effect* motor memory consolidation (experiment, n=26, healthy older adults, nap): "spindle-inspired tACS, as used in the present study, did not enhance either spindles or memory consolidation" Impact of spindle-inspired transcranial alternating current stimulation during a nap on sleep-dependent motor memory consolidation in healthy older adults (2025) `doi:10.1093/sleepadvances/zpaf022`
- targeted memory reactivation *no-effect* motor memory consolidation (experiment, n=40, Parkinson's disease and healthy older adults, 2-h nap): "Results showed no effect of TMR on motor retention or dual-tasking, with no difference between the groups." Targeted memory reactivation during sleep modulates spindle and slow wave density, but not motor memory consolidation, in Parkinson’s disease (2026) `doi:10.64898/2026.04.22.26351552`
- targeted memory reactivation *decreases* sleep spindle (experiment, n=40, Parkinson's disease and healthy older adults, 2-h nap): "the TMR intervention did increase slow-wave density and decreased spindle density in both groups" Targeted memory reactivation during sleep modulates spindle and slow wave density, but not motor memory consolidation, in Parkinson’s disease (2026) `doi:10.64898/2026.04.22.26351552`
- targeted memory reactivation *no-effect* motor memory consolidation (experiment, n=17, older adults, post-learning nap): "older adults do not benefit from specific reactivation of a motor memory trace by an associated auditory cue" Targeted memory reactivation during post‐learning sleep does not enhance motor memory consolidation in older adults (2023) `doi:10.1111/jsr.14027`

**Disprover:** 10 searches across openalex, pubmed, clinicaltrials, europepmc, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- Half of g01, whether CLAS raises SO–spindle coupling in older adults, is already answered. Multi-night phase-locked acoustic stimulation in 32 healthy older adults (mean age 68.9) produced a 24% increase in SO-coupled spindles. A 2026 sham-controlled crossover in 16 adults aged 60+ (two stimulation nights) enhanced NREM oscillations, but word-pair recall did not improve at group level. In a middle-aged sample (55.7 y), closed-loop stimulation's effect on SOs and on several memory tasks differed from young adults, a finding the gap does not cite. The open part is narrower: no study has a procedural/finger-tapping outcome under whole-night CLAS in adults over 60, and none has tested a stimulus-count dose-response. The gap should be restated around that motor outcome rather than coupling. (Acoustic stimulation during sleep predicts long-lasting increases in memory performance and beneficial amyloid response in older adults `doi:10.1093/ageing/afad228`; Closed-Loop Auditory Stimulation Reveals Differential Sleep Oscillatory Contributions to Memory in Healthy Older Adults `doi:10.64898/2026.08.17.745219`; Susceptibility to auditory closed-loop stimulation of sleep slow oscillations changes with age `doi:10.1093/sleep/zsaa111`; The effects of closed-loop auditory stimulation on sleep oscillatory dynamics in relation to motor procedural memory consolidation `doi:10.1093/sleep/zsad206`)

<details><summary>Score rationale</summary>

- novelty: Disprover d1-01 shows the coupling half is answered (24% rise in SO-coupled spindles in 32 older adults; 2026 crossover in 60+), so only the finger-tapping outcome and stimulus-count dose-response remain open across 10 queries and 5 databases.
- importance: Spindle-targeted tools (tACS, TMR) have failed in older adults (c0022, c0027, c0052), so a positive or clean-null CLAS motor result would tell the field whether any non-invasive sleep intervention can rescue procedural consolidation with age.
- tractability: Home and lab CLAS systems exist and multi-night CLAS in 60+ samples has been run (d1-01), so a sham-controlled crossover with a finger-tapping task and logged stimulus counts is feasible at modest n.
- evidence_gap: The only motor-outcome CLAS data are one n=20 young-adult nap study with a null group effect and a post-hoc dose-response (c0084, c0085), and older-adult CLAS has only declarative outcomes, which are null at group level (d1-01).

</details>

### 2. In healthy adults aged 60-80 randomised to sleep vs wake retention intervals, do overtraining (extended practice to asymptote) and effector type (individuated-finger vs whole-hand sequence) interact to determine whether sleep-dependent motor sequence gains appear?

`g03` · signal: contradiction · score 192 (novelty 4, importance 3, tractability 4, evidence gap 4)

Older adults' failure to show sleep-dependent gains seems to depend on the task. A whole-hand version of the sequence task brought back overnight gains where the finger version did not, and this has been put down to declining fine dexterity (c0080-c0082, c0068). Overtraining restored sleep benefit in one sample (c0088) but not in two others (c0049, c0094). Each factor has been tested only alone, in small samples (n≈17-24), so it is unknown whether the effects add up or whether one masks the other.

**Evidence it rests on**

- sleep *no-effect* motor memory consolidation (experiment, older adults, individuated finger sequence task): "older adults did not show sleep-dependent consolidation" Sleep-dependent motor memory consolidation in older adults depends on task demands (2014) `doi:10.1016/j.neurobiolaging.2014.12.014`
- whole-hand motor task *enables* motor memory consolidation (experiment, older adults, overnight sleep): "when tested with an adapted sequence learning task, in which movements were performed with the whole hand, sleep-dependent motor improvement was observed in older adults" Sleep-dependent motor memory consolidation in older adults depends on task demands (2014) `doi:10.1016/j.neurobiolaging.2014.12.014`
- fine motor dexterity *associated* motor memory consolidation (experiment, older adults): "age-related decline in fine motor dexterity may in part be responsible for the previously described deficit in sleep-dependent motor consolidation with aging" Sleep-dependent motor memory consolidation in older adults depends on task demands (2014) `doi:10.1016/j.neurobiolaging.2014.12.014`
- whole-hand motor task *associated* motor memory consolidation (review, n=383, healthy older adults): "Tasks with whole hand or whole body movements could show significant changes" The effect of sleep on motor learning in the aging and stroke population – a systematic review (2015) `doi:10.3233/rnn-150521`
- overtraining *enables* motor memory consolidation (experiment, older adults (62-75), 12-h sleep vs wake): "overtrained older adults exhibited a significant sleep-related benefit in performance" Sleep Benefits Procedural Motor Learning in Older Adults With Additional Practice (2025) `doi:10.7275/hec9-z333`
- over-training *no-effect* sleep-dependent consolidation (experiment, n=24, healthy older adults, explicit motor sequence): "additional training does not improve the chances of demonstrating such gains, despite significantly improving initial performance" 0071 Does Additional Training on a Motor Sequence Task Improve Sleep-Dependent Memory Consolidation for Older Adults? (2024) `doi:10.1093/sleep/zsae067.0071`
- overtraining *no-effect* motor memory consolidation (experiment, n=17, older adults, train vs overtrain): "regardless of initial learning, older adults fail to exhibit SDC" 0122 Does Additional Training on an Implicit Motor Sequence Learning Task for Older Adults Improve Sleep-Dependent Memory Consolidation? (2020) `doi:10.1093/sleep/zsaa056.120`
- sleep *no-effect* motor memory consolidation (experiment, n=24, healthy older adults, explicit motor sequence, sleep vs wake): "Our results replicate prior findings that standard training of a motor sequence task in older adults does not demonstrate sleep-dependent memory gains." 0071 Does Additional Training on a Motor Sequence Task Improve Sleep-Dependent Memory Consolidation for Older Adults? (2024) `doi:10.1093/sleep/zsae067.0071`

**Disprover:** 10 searches across openalex, pubmed, europepmc, clinicaltrials, arxiv; no work found that answers it.

<details><summary>Score rationale</summary>

- novelty: The disprover found no weakening work in 10 queries across 5 sources; overtraining (c0088, c0049, c0094) and effector type (c0081) have each only been tested on their own.
- importance: It would explain why older adults' sleep-dependent motor gains appear in some paradigms and not others, which matters for task choice in research and rehabilitation, though it is a moderator question rather than a mechanism question.
- tractability: A 2x2 behavioural design with sleep-vs-wake intervals needs no PSG and uses standard tasks, though a three-way interaction needs a larger sample than the n≈17-24 studies so far.
- evidence_gap: Overtraining findings directly conflict (c0088 positive vs c0049 and c0094 null), and the whole-hand result rests on a single study with unreported n (c0081).

</details>

### 3. Do older adults with amnestic mild cognitive impairment show reduced overnight sleep-dependent gains on a motor sequence task compared with cognitively normal age-matched controls, and is the difference explained by fast-spindle density or N3 slow-wave activity on PSG?

`g08` · signal: missing-link · score 192 (novelty 4, importance 4, tractability 3, evidence gap 4)

MCI is named as a population of interest, and SWS and spindle reductions are described across healthy ageing and MCI (c0001, c0002). Yet every procedural consolidation study here uses healthy older adults, Parkinson's disease, stroke, OSA or depression (c0010, c0044, c0078, c0103). Fast-spindle density is the most consistent microstructural predictor of motor consolidation in older samples (c0035, c0108). No claim tests whether that pathway is further impaired, or relatively spared, in MCI, where procedural memory is often thought preserved.

**Evidence it rests on**

- aging *decreases* slow-wave sleep (review, healthy aging and MCI): "Changes include reductions in slow-wave sleep's (SWS) percent and spectral power in the sleep electroencephalogram (EEG), number and amplitude of sleep spindles" Sleep-dependent memory consolidation in healthy aging and mild cognitive impairment. (2015) `doi:10.1007/7854_2014_300`
- aging *decreases* sleep spindle (review, healthy aging and MCI): "Changes include reductions in slow-wave sleep's (SWS) percent and spectral power in the sleep electroencephalogram (EEG), number and amplitude of sleep spindles" Sleep-dependent memory consolidation in healthy aging and mild cognitive impairment. (2015) `doi:10.1007/7854_2014_300`
- sleep spindle *associated* motor memory consolidation (experiment, older adults, frontal fast spindles): "with the extent of impairment being associated with the degree of reduced frontal fast sleep spindle density" White Matter Structure in Older Adults Moderates the Benefit of Sleep Spindles on Motor Memory Consolidation (2017) `doi:10.1523/jneurosci.3033-16.2017`
- fast sleep spindle *associated* motor memory consolidation (experiment, n=173, older and younger adults, N3 sleep, ambulatory PSG): "only fast spindle density during N3 sleep significantly predicted motor memory consolidation" Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`
- aging *decreases* sleep-dependent consolidation (review, healthy aging, motor-sequence learning): "with healthy aging, although SDC for declarative memory is preserved, certain procedural tasks, such as motor-sequence learning, do not show SDC" Sleep-dependent memory consolidation in healthy aging and mild cognitive impairment. (2015) `doi:10.1007/7854_2014_300`

**Disprover:** 10 searches across pubmed, openalex, europepmc, clinicaltrials, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- Procedural sequence learning and its consolidation have been compared in MCI versus healthy elderly on the ASRT task (MCI showed weaker learning), so 'every procedural consolidation study uses non-MCI groups' is not accurate. A 2026 study links spindles and white matter differently in older adults with versus without cognitive impairment. A systematic review of motor learning in MCI finds that retention was compared with controls in only one study, which supports keeping a narrowed gap: overnight sleep-versus-wake motor-sequence gains in amnestic MCI with PSG spindle/SWA mediation. (Probabilistic sequence learning in mild cognitive impairment `doi:10.3389/fnhum.2013.00318`; Motor Learning in Older Adults with Mild Cognitive Impairment: A Systematic Review `doi:10.1007/s11065-025-09661-x`; Sleep spindles are linked to white matter connectivity differentially in older adults with and without cognitive impairment `doi:10.1093/braincomms/fcag303`)

<details><summary>Score rationale</summary>

- novelty: d1-07 shows ASRT learning has been compared in MCI and that spindle-white matter links differ by cognitive status, but a systematic review finds retention compared with controls in only one study, and no overnight sleep-vs-wake motor-sequence study with PSG in amnestic MCI was found.
- importance: It would test whether the procedural sleep pathway is preserved or impaired in prodromal Alzheimer's disease, which bears on both mechanistic models and on whether procedural training can be used in MCI rehabilitation.
- tractability: Amnestic MCI cohorts with PSG are available in memory clinics, but sleep-vs-wake designs with overnight PSG in MCI need careful diagnosis and moderately large samples.
- evidence_gap: Every procedural-consolidation claim in the corpus comes from non-MCI groups (c0010, c0044, c0078), and the MCI sleep evidence is review-level only (c0001, c0002).

</details>

### 4. In a young-vs-older adult comparison on the finger-tapping task, does the age difference in sleep-vs-wake offline gains survive when gain scores use the final-block (not averaged) measure, reactive inhibition is controlled with spaced training blocks, and time-of-testing is counterbalanced?

`g04` · signal: method-transfer · score 144 (novelty 3, importance 4, tractability 4, evidence gap 3)

A meta-analysis (n=1296) found that the apparent sleep benefit for motor sequence learning disappears once averaging in gain scores, reactive inhibition, time of testing and training duration are accounted for. It also flagged elderly status as a moderator (c0038, c0039). The age-comparison experiments that report reduced sleep-dependent consolidation in older adults (c0031, c0034, c0054, c0087, c0107) do not use these artefact controls. So it is unclear whether the 'age deficit' is a real loss of sleep-dependent consolidation, or a difference in how young and old adults show reactive-inhibition recovery.

**Evidence it rests on**

- sleep *no-effect* motor memory consolidation (meta-analysis, n=1296, motor sequence learning studies, moderators controlled): "With those variables accounted for, there was no evidence that sleep enhances learning." Sleep and motor learning: Is there room for consolidation? (2015) `doi:10.1037/bul0000009`
- aging *other* sleep-dependent consolidation (meta-analysis, n=1296, elderly status as moderator): "strong moderating effects of 4 previously hypothesized variables: averaging in the calculation of prepost gain scores, build-up of reactive inhibition over training, time of testing, and training duration, along with 1 supplemental variable, elderly status" Sleep and motor learning: Is there room for consolidation? (2015) `doi:10.1037/bul0000009`
- aging *decreases* motor memory consolidation (experiment, n=26, young vs older adults, SRTT, 24-h retest): "older participants failed to show skill improvement at re-test as the young participants did" Sequence Skill Acquisition and Off-Line Learning in Normal Aging (2009) `doi:10.1371/journal.pone.0006683`
- aging *decreases* sleep-dependent consolidation (experiment, young vs older adults, overnight motor skill): "older adults show impoverished overnight motor skill memory consolidation relative to young adults" White Matter Structure in Older Adults Moderates the Benefit of Sleep Spindles on Motor Memory Consolidation (2017) `doi:10.1523/jneurosci.3033-16.2017`
- aging *decreases* motor memory consolidation (experiment, healthy young vs older adults, overnight sleep vs wake): "This effect was markedly reduced in older adults" Insufficient chunk concatenation may underlie changes in sleep-dependent consolidation of motor sequence learning in older adults (2016) `doi:10.1101/lm.043042.116`
- aging *decreases* motor memory consolidation (experiment, young (18-24) vs older adults (62-75), explicit SRTT): "Behavioral results demonstrated significant SDC in young adults but not in standard-trained older adults" Sleep Benefits Procedural Motor Learning in Older Adults With Additional Practice (2025) `doi:10.7275/hec9-z333`
- aging *decreases* motor memory consolidation (experiment, n=173, older vs younger adults, gross motor sequence task): "Younger adults showed greater overnight performance improvements than older adults." Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`
- sleep *no-effect* motor memory consolidation (experiment, n=112, older vs young adults, 12 h sleep vs wake, motor sequence task): "Thus, OA do not preferentially consolidate sequence learning over wake or sleep." Age-related changes in consolidation of perceptual and muscle-based learning of motor skills (2013) `doi:10.3389/fnagi.2013.00083`

**Disprover:** 10 searches across openalex, pubmed, europepmc, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- The idea that the age deficit is a measurement artefact is already debated in print: Adi-Japha & Karni wrote a comment on Pan & Rickard citing developmental and task-demand constraints, and Pan & Rickard replied. Age-comparison data also exist where neither group shows sleep-specific gains. On an implicit sequence task, sleep had no critical role in either young or old adults. The older-adult finger-tapping study found sleep modulated word-pair learning but not motor sequence learning. So the gap cannot assume a well-established 'age deficit' to explain away. It should be narrowed to explicit finger-tapping with artefact-controlled gain scores. (Time for considering constraints on procedural memory consolidation processes: Comment on Pan and Rickard (2015) with specific reference to developmental changes. `doi:10.1037/bul0000048`; Time for considering the possibility that sleep plays no unique role in motor memory consolidation: Reply to Adi-Japha and Karni (2016). `doi:10.1037/bul0000094`; Sleep has no critical role in implicit motor sequence learning in young and old adults (2009) `doi:10.1007/s00221-009-2024-x`; Sleep modulates word-pair learning but not motor sequence learning in healthy older adults (2012) `doi:10.1016/j.neurobiolaging.2011.06.029`)

<details><summary>Score rationale</summary>

- novelty: The artefact explanation is already argued in print (Pan & Rickard comment and reply), and some age comparisons show no sleep-specific gains in either group (d1-03); still, no artefact-controlled young-vs-old finger-tapping experiment was found.
- importance: If the age deficit (c0031, c0034, c0054, c0087, c0107) disappears under artefact controls, much of the field's mechanistic work on why older adults lose sleep-dependent consolidation would be built on a measurement problem.
- tractability: It is a behavioural study using standard tasks, spaced blocks and counterbalanced testing times; the only real cost is the sample size needed for an age × condition interaction.
- evidence_gap: The meta-analysis (c0038, c0039) and age-comparison experiments point in different directions, but d1-03 shows the 'age deficit' is itself inconsistent (c0101 and others), so the evidence is mixed rather than missing.

</details>

### 5. In healthy adults aged 60+, does evening training (sleep within ~2 h) vs morning training (with a matched 24-h retest) increase motor sequence retention at 24 h and 1 week, on both a finger-tapping task and a gross-motor sequence task?

`g10` · signal: contradiction · score 108 (novelty 3, importance 3, tractability 4, evidence gap 3)

One study in elderly participants found that evening finger-tapping training produced extra overnight and 1-week gains compared with morning training (c0033). The largest age-comparison study (n=173, gross-motor sequence, ambulatory PSG) found training time had no effect on consolidation (c0111). The meta-analysis lists time of testing as a strong moderator (c0038, c0039). The disagreement could come from task (fine vs gross motor) or from the delay before sleep. That needs a direct factorial test in older adults, because training timing is a cheap and practical rehabilitation lever.

**Evidence it rests on**

- evening practice *increases* motor memory consolidation (experiment, elderly, finger tapping, morning vs evening training): "evening-trained participants showed additional gains overnight and at 1 wk posttraining" Better later: evening practice is advantageous for motor skill consolidation in the elderly (2021) `doi:10.1101/lm.052522.120`
- training time *no-effect* motor memory consolidation (experiment, n=173, older and younger adults, morning vs evening training): "Training time (morning vs. evening) had no effect on consolidation." Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`
- sleep *no-effect* motor memory consolidation (meta-analysis, n=1296, motor sequence learning studies, moderators controlled): "With those variables accounted for, there was no evidence that sleep enhances learning." Sleep and motor learning: Is there room for consolidation? (2015) `doi:10.1037/bul0000009`
- aging *other* sleep-dependent consolidation (meta-analysis, n=1296, elderly status as moderator): "strong moderating effects of 4 previously hypothesized variables: averaging in the calculation of prepost gain scores, build-up of reactive inhibition over training, time of testing, and training duration, along with 1 supplemental variable, elderly status" Sleep and motor learning: Is there room for consolidation? (2015) `doi:10.1037/bul0000009`
- aging *decreases* motor memory consolidation (experiment, n=173, older vs younger adults, gross motor sequence task): "Younger adults showed greater overnight performance improvements than older adults." Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`

**Disprover:** 10 searches across pubmed, openalex, europepmc, clinicaltrials, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- For fine-motor training, the evening advantage in elderly adults is replicated beyond the single study the gap cites. A 10-session, multi-week programme found evening training led to better long-term retention than morning training in healthy elderly, alongside the single-session finger-tapping result (Learning & Memory). Time-of-day effects on finger-tapping consolidation (gain only after 8 pm training) are also shown in younger adults. What remains is narrower: a fine- versus gross-motor factorial in older adults, since the null result comes from the footstep-task study. (A Delayed Advantage: Multi-Session Training at Evening Hours Leads to Better Long-Term Retention of Motor Skill in the Elderly `doi:10.3389/fnagi.2019.00321`; Better later: evening practice is advantageous for motor skill consolidation in the elderly (2021) `doi:10.1101/lm.052522.120`; Time of day and sleep effects on motor acquisition and consolidation `doi:10.1038/s41539-023-00176-9`; Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`)

<details><summary>Score rationale</summary>

- novelty: d1-09 shows the evening advantage for fine-motor training in elderly people has been replicated, including in a 10-session programme, so only the fine-vs-gross-motor factorial in older adults is still untested.
- importance: Training time is a cheap rehabilitation lever, but the fine-motor answer already exists, so the added value is mainly whether it generalises to gross-motor skills.
- tractability: A behavioural morning-vs-evening × task factorial with 24-h and 1-week retests needs no special equipment and is cheap to run.
- evidence_gap: Fine-motor evidence now converges (c0033 plus replications in d1-09), and the conflict is mostly with one gross-motor null (c0111), so the remaining uncertainty is narrower than first framed.

</details>

### 6. In adults aged 65+ with moderate-to-severe obstructive sleep apnea, does 4-12 weeks of adherent CPAP, compared with sham CPAP, improve overnight motor sequence consolidation, and is improvement mediated by restored N2 spindle density or reduced sleep fragmentation?

`g05` · signal: weak-evidence · score 96 (novelty 3, importance 4, tractability 2, evidence gap 4)

OSA severity correlates with worse motor procedural learning in older adults (c0044). The only intervention tested is a single night of nocturnal oxygen, which reduced hypoxemia but did not change procedural learning (c0045, c0046). That leaves open whether fragmentation rather than hypoxemia is the active ingredient (c0004, c0074). No randomised trial in this corpus tests sustained CPAP against a procedural outcome in older adults.

**Evidence it rests on**

- obstructive sleep apnea *decreases* procedural memory consolidation (observational, n=65, older adults 65+, overnight PSG, motor sequence task): "more severe sleep apnea is associated with worse motor procedural learning in older adults" Procedural learning worsens with OSA severity in older adults and is insensitive to short exposure supplemental oxygen therapy (2025) `doi:10.1016/j.sleep.2025.106821`
- nocturnal oxygen supplementation *no-effect* procedural memory consolidation (rct, n=65, older adults with OSA, randomized crossover): "a single night of NOS treatment had no effect on procedural learning" Procedural learning worsens with OSA severity in older adults and is insensitive to short exposure supplemental oxygen therapy (2025) `doi:10.1016/j.sleep.2025.106821`
- nocturnal oxygen supplementation *decreases* nocturnal hypoxemia (rct, n=65, older adults with OSA, randomized crossover): "Nocturnal hypoxemia was reduced with NOS treatment." Procedural learning worsens with OSA severity in older adults and is insensitive to short exposure supplemental oxygen therapy (2025) `doi:10.1016/j.sleep.2025.106821`
- sleep fragmentation *decreases* sleep-dependent consolidation (review, young adults and healthy aging): "In younger adults, fragmentation of sleep can reduce SDC, and a normative increase in sleep fragmentation may account for reduced SDC with healthy aging." Sleep-dependent memory consolidation in healthy aging and mild cognitive impairment. (2015) `doi:10.1007/7854_2014_300`
- sleep fragmentation *decreases* motor memory consolidation (review, older adults): "Interruptions in these sleep stages seem to hinder the neurological changes required for enduring enhancements in motor skills" The Sleep-Aging-Motor Memory Triad: A Systematic Review of Task-Dependent Consolidation and Neuroplasticity (2026) `doi:10.31234/osf.io/5yqjg_v1`

**Disprover:** 10 searches across pubmed, openalex, clinicaltrials, europepmc; no work found that answers it.

**Caveats raised by the disprover**

- The claim that only nocturnal oxygen has been tested is wrong. Compliant CPAP users showed overnight finger-tapping gains like healthy controls, while untreated moderate–severe OSA patients declined (non-randomised, not restricted to older adults). A single night of CPAP did not restore offline motor consolidation, so treatment duration matters. A sham-CPAP RCT with a procedural memory outcome is registered (NCT00464659). A multicentre RCT of 3-month OSA treatment in cognitively normal older adults with memory outcomes is underway (ESSENTIAL, NCT05988385; open-label waitlist, not sham). What remains is narrower: a sham-controlled trial in people 65+ with an overnight motor-sequence outcome and spindle/fragmentation mediation. (Overnight Motor Skill Learning Outcomes in Obstructive Sleep Apnea: Effect of Continuous Positive Airway Pressure `doi:10.5664/jcsm.5794`; First night of CPAP: impact on memory consolidation attention and subjective experience `doi:10.1016/j.sleep.2015.01.017`; Comparison of the Evolution of Memory Deficit in Patients With Sleep Apnea Obstructive Syndrome (SAOS) Before and After "Effective" Versus Sham Treatment by Positive Pression Continues (PPC) `nct:NCT00464659`; The Effects of Successful OSA Treatment on Memory and AD Biomarkers in Older Adults (ESSENTIAL) Study `nct:NCT05988385`)

<details><summary>Score rationale</summary>

- novelty: d1-04 finds non-randomised CPAP finger-tapping data, a single-night CPAP null, a registered sham-CPAP trial with a procedural outcome (NCT00464659) and an open-label older-adult trial underway (NCT05988385), which leaves only the sham-controlled 65+ motor-sequence trial with mediation analysis.
- importance: OSA is common in older adults and treatable, so showing that sustained CPAP restores motor consolidation (and whether fragmentation or spindles mediate it) would directly inform clinical and rehabilitation practice.
- tractability: A 4-12-week sham-CPAP RCT in people over 65 is expensive, faces known adherence problems and needs repeated PSG for mediation, so a decisive study is costly.
- evidence_gap: The only randomised older-adult evidence is one night of oxygen (c0045, c0046) plus a correlational severity link (c0044); CPAP evidence is non-randomised and not age-restricted (d1-04).

</details>

### 7. In chronic stroke survivors aged 60+, does a full night of sleep, compared with a daytime nap or an equivalent wake interval, produce offline gains on a paretic-hand motor sequence task, and do these gains predict functional upper-limb recovery over rehabilitation?

`g07` · signal: contradiction · score 96 (novelty 3, importance 4, tractability 2, evidence gap 4)

A review concluded that sleep improves motor performance after stroke compared with wake, while healthy older controls show no such benefit (c0066, c0067). A randomised nap study in chronic stroke found no sleep-dependent consolidation either after the nap or after a following night (c0078, c0079). It is unclear whether the benefit is limited to nocturnal sleep, to particular lesion profiles, or comes from comparisons with young controls. No study links the size of offline gains to rehabilitation outcomes.

**Evidence it rests on**

- sleep *increases* motor memory consolidation (review, n=383, people after stroke): "sleep was found to enhance motor performance in people after stroke in comparison to an equivalent time of wakefulness" The effect of sleep on motor learning in the aging and stroke population – a systematic review (2015) `doi:10.3233/rnn-150521`
- sleep *no-effect* motor memory consolidation (review, n=383, healthy older adults): "In older adults the effect of a sleep intervention did - in general - not differ from equivalent periods of wakefulness" The effect of sleep on motor learning in the aging and stroke population – a systematic review (2015) `doi:10.3233/rnn-150521`
- daytime nap *no-effect* motor memory consolidation (rct, n=30, chronic stroke survivors): "there was no evidence for sleep-dependent motor consolidation early after the initial, diurnal break, or after an additional full night of sleep" Can Daytime Napping Assist the Process of Skills Acquisition After Stroke? (2018) `doi:10.3389/fneur.2018.01002`
- daytime nap *no-effect* motor memory consolidation (rct, chronic stroke survivors and healthy older adults): "daytime sleep did not impact on the behavioral gains in the two groups" Can Daytime Napping Assist the Process of Skills Acquisition After Stroke? (2018) `doi:10.3389/fneur.2018.01002`

**Disprover:** 10 searches across pubmed, openalex, clinicaltrials, europepmc, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- The gap says no study links offline gains to rehabilitation outcomes. That half is now being studied: the SMiLES longitudinal protocol tests whether sleep-dependent motor-sequence consolidation mediates the link between post-stroke sleep and clinical motor outcomes. Night-sleep versus wake offline learning in chronic stroke is already shown on a tracking task. In chronic stroke with PSG, offline gains have been linked to sleep parameters and functional status. What is left is the nocturnal-versus-nap comparison on a paretic-hand sequence task in survivors aged 60+. (Sleep and motor learning in stroke (SMiLES): a longitudinal study investigating sleep-dependent consolidation of motor sequence learning in the context of recovery after stroke `doi:10.1136/bmjopen-2023-077442`; Sleep Enhances Off-line Spatial and Temporal Motor Learning After Stroke `doi:10.1177/1545968308326631`; Sleep Parameters, Functional Status, and Time Post-Stroke are Associated with Offline Motor Skill Learning in People with Chronic Stroke `doi:10.3389/fneur.2015.00225`; Mechanisms Underlying the Beneficial Effects of Naps on Motor Learning `nct:NCT04312126`)

<details><summary>Score rationale</summary>

- novelty: The link from offline gains to rehabilitation outcomes is being studied in the SMiLES protocol, and night-vs-wake offline learning in chronic stroke has been shown on a tracking task (d1-06), leaving the night-vs-nap paretic-hand sequence comparison in survivors aged 60+.
- importance: If nocturnal sleep, but not naps, drives offline motor gains after stroke, that would directly shape when rehabilitation sessions are scheduled.
- tractability: Recruiting chronic stroke survivors over 60 for sleep/nap/wake conditions with PSG plus longitudinal functional follow-up is slow and costly, and lesion heterogeneity calls for large samples.
- evidence_gap: A review claims a sleep benefit after stroke (c0066), while the only randomised nap study (n=30) found none even after a following night (c0078); the claims directly conflict and rest on very little data.

</details>

### 8. In healthy adults aged 60+ with overnight PSG after motor sequence training, does SO-spindle coupling strength or phase predict sleep-dependent offline gains once fast-spindle density is entered in the same preregistered model?

`g02` · signal: contradiction · score 72 (novelty 2, importance 3, tractability 4, evidence gap 3)

The evidence conflicts. Coupling tracked offline gains in older adults after a nap on a cognitive procedural task (c0009) and in young nappers (c0086). In two overnight studies, including the largest (n=173), coupling did not predict consolidation while fast-spindle density did (c0089, c0109, c0108). Even the direction of the age effect on coupling disagrees: lower in older adults in one study (c0008), higher in another (c0090). No study has tested coupling and spindle density against each other, with consistent detection methods, in an older sample powered for that comparison.

**Evidence it rests on**

- aging *decreases* spindle-slow wave coupling (experiment, n=70, young vs older adults, 90-min nap): "the percentage of coupled spindles was lower in older compared to younger individuals from control to testing sessions" Spindle-slow wave coupling and problem-solving skills: impact of age. (2024) `doi:10.1093/sleep/zsae072`
- spindle-slow wave coupling *associated* procedural memory consolidation (experiment, n=70, older adults, Tower of Hanoi, nap): "there was a significant relationship between offline gains in accuracy on the ToH and percent change of spindles coupled to the upstate of the slow wave in older, but not younger adults" Spindle-slow wave coupling and problem-solving skills: impact of age. (2024) `doi:10.1093/sleep/zsae072`
- spindle-slow oscillation coupling *associated* motor memory consolidation (experiment, n=20, healthy adults, afternoon nap): "coupled SO-spindle density (#/min) in a centro-parietal cluster significantly correlated with memory improvement" Evaluating Closed-loop Auditory Stimulation during Sleep as an Intervention to Improve Memory Consolidation (4149) (2021) `doi:10.1212/wnl.96.15_supplement.4149`
- spindle-slow oscillation coupling *no-effect* motor memory consolidation (experiment, young and older adults, overnight PSG): "stronger coupling did not predict greater SDC in either age group" Sleep Benefits Procedural Motor Learning in Older Adults With Additional Practice (2025) `doi:10.7275/hec9-z333`
- aging *increases* spindle-slow oscillation coupling (experiment, young vs older adults, NREM2): "Contrary to expectations, young adults showed weaker coupling during NREM2" Sleep Benefits Procedural Motor Learning in Older Adults With Additional Practice (2025) `doi:10.7275/hec9-z333`
- fast sleep spindle *associated* motor memory consolidation (experiment, n=173, older and younger adults, N3 sleep, ambulatory PSG): "only fast spindle density during N3 sleep significantly predicted motor memory consolidation" Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`
- slow oscillation-spindle coupling *no-effect* motor memory consolidation (experiment, n=173, older and younger adults, ambulatory PSG): "N3 percentage, SO density, and SO–spindle coupling were unrelated to overnight performance changes." Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`

**Disprover:** 10 searches across openalex, pubmed, europepmc, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- Whether coupling metrics predict consolidation, and how age changes that, has been pooled already. A Bayesian meta-analysis (23 studies, 297 effect sizes) models coupling phase, strength and percentage against consolidation with physiological and behavioural moderators. In an older sample, precise SO–fast-spindle coupling predicted retention, and older adults showed a shift to slow-spindle power later in the up-state. That gives one explanation for the opposite age-direction findings the gap lists (detection band and timing). What is still open is a narrower question: a head-to-head of coupling versus fast-spindle density for motor-sequence tasks in older adults, using harmonised detection. (Bayesian meta-analysis reveals the mechanistic role of slow oscillation-spindle coupling in sleep-dependent memory consolidation `doi:10.7554/elife.101992`; Precise Slow Oscillation–Spindle Coupling Promotes Memory Consolidation in Younger and Older Adults `doi:10.1038/s41598-018-36557-z`; Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`)

<details><summary>Score rationale</summary>

- novelty: A Bayesian meta-analysis of 23 studies already models coupling phase and strength against consolidation with age moderators, and an older-adult study links precise SO-fast-spindle coupling to retention (d1-02), leaving only a harmonised motor-specific head-to-head.
- importance: Settling whether coupling adds anything beyond fast-spindle density would sharpen which biomarker interventions should target, but it refines rather than overturns the current spindle-centred account.
- tractability: It can be done largely by reanalysing existing overnight PSG plus motor-sequence datasets (e.g., the n=173 ambulatory sample, c0108/c0109) with a preregistered model and common detectors.
- evidence_gap: Results conflict (c0009/c0086 vs c0089/c0109) and even the age direction disagrees (c0008 vs c0090), but d1-02 offers a detection-band explanation and the largest study points clearly to spindle density, so the conflict is partly resolved.

</details>

### 9. In older adults (60+), does a post-training daytime nap of at least 60 minutes containing N2 spindles produce larger 24-h motor sequence retention than matched wake, and does the effect depend on explicit vs implicit sequence knowledge?

`g06` · signal: contradiction · score 72 (novelty 2, importance 3, tractability 4, evidence gap 3)

Nap studies in older adults split almost evenly. A nap helped explicit SRTT and motor sequence consolidation in some (c0013, c0040), and a systematic review concluded naps help motor learning (c0047). Other crossover and randomised studies with short and long naps found no effect in healthy older adults, Parkinson's disease or stroke (c0010, c0050, c0051, c0079). These studies differ in nap length, task explicitness and retest timing, and the largest has n=64, so the null results cannot be told apart from low power or design heterogeneity.

**Evidence it rests on**

- daytime nap *no-effect* motor memory consolidation (rct, n=64, Parkinson's disease and healthy older adults, finger tapping): "The behavioural results suggest similar consolidation effects after sleep and wakefulness in both populations." The Effect of a Post-Learning Nap on Motor Memory Consolidation in People With Parkinson's Disease: A Randomised Controlled Trial. (2026) `doi:10.1111/jsr.70203`
- daytime nap *increases* motor memory consolidation (experiment, healthy older adults, motor sequence, nap vs wake): "Results demonstrated that a post-learning nap improved offline consolidation across same- and next-day retests." Cerebral Activation During Initial Motor Learning Forecasts Subsequent Sleep-Facilitated Memory Consolidation in Older Adults (2016) `doi:10.1093/cercor/bhv347`
- daytime nap *increases* motor memory consolidation (experiment, n=36, older adults, explicit SRTT, nap vs wake): "learning scores indicated significantly better performance following a nap than wake interval in older adults (p = .043)" 0275 Age-Related Changes in Sleep-Dependent Procedural Learning Consolidation (2019) `doi:10.1093/sleep/zsz067.274`
- daytime nap *increases* motor learning (review, n=326, older adults, systematic review of 15 studies): "Daytime napping had an overall positive impact on subjective measures (i.e., sleepiness and fatigue), psychomotor performances (i.e., speed and accuracy) and learning abilities (i.e., declarative and motor learning)." Benefits and risks of napping in older adults: A systematic review (2022) `doi:10.3389/fnagi.2022.1000707`
- daytime nap *no-effect* motor memory consolidation (experiment, healthy older adults, sequence and adaptation tasks, crossover): "Older adults exhibited learning gains, these were not found to be sleep-dependent in either task." Motor Performance Is not Enhanced by Daytime Naps in Older Adults (2016) `doi:10.3389/fnagi.2016.00125`
- daytime nap *no-effect* motor learning (experiment, healthy older adults, short and long naps): "The results suggest that daytime naps do not have an impact on performance and motor learning in an aging population." Motor Performance Is not Enhanced by Daytime Naps in Older Adults (2016) `doi:10.3389/fnagi.2016.00125`
- daytime nap *no-effect* motor memory consolidation (rct, chronic stroke survivors and healthy older adults): "daytime sleep did not impact on the behavioral gains in the two groups" Can Daytime Napping Assist the Process of Skills Acquisition After Stroke? (2018) `doi:10.3389/fneur.2018.01002`
- aging *no-effect* sleep-dependent consolidation (experiment, n=36, young vs older adults, explicit SRTT): "This result suggests that some sleep-dependent consolidation of explicit procedural learning may be preserved in older adults." 0275 Age-Related Changes in Sleep-Dependent Procedural Learning Consolidation (2019) `doi:10.1093/sleep/zsz067.274`

**Disprover:** 10 searches across pubmed, openalex, europepmc, clinicaltrials, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- A meta-analysis of 60 samples from 54 nap studies found a significant procedural-memory benefit of naps (d≈0.49). It tested age, nap length, nap start time and habituality as moderators and found none significant, so the 'is it power or heterogeneity' question has partly been addressed. A crossover in healthy older adults already compared short (10–20 min sleep) and long (50–70 min sleep) naps against wake and found gains that were not sleep-dependent. An explicit-SRTT nap study did find nap-dependent consolidation in older adults. An NIH study (NCT04312126) covering ages 50–80 and chronic stroke is examining nap mechanisms for motor learning. The remaining gap is narrower: the explicit-versus-implicit interaction with naps of 60 minutes or more and 24-h retest. (Systematic review and meta-analyses on the effects of afternoon napping on cognition `doi:10.1016/j.smrv.2022.101666`; Motor Performance Is not Enhanced by Daytime Naps in Older Adults (2016) `doi:10.3389/fnagi.2016.00125`; Encoding and consolidation of motor sequence learning in young and older adults (2021) `doi:10.1016/j.nlm.2021.107508`; Mechanisms Underlying the Beneficial Effects of Naps on Motor Learning `nct:NCT04312126`)

<details><summary>Score rationale</summary>

- novelty: A 54-study nap meta-analysis found a procedural benefit (d≈0.49) with no age or nap-length moderation, older-adult short-vs-long nap crossovers already exist, and NCT04312126 is ongoing (d1-05), so only the explicit-vs-implicit × ≥60-min-nap interaction is new.
- importance: It would clarify whether napping is a usable consolidation aid in older adults, which is practically relevant, but the narrowed explicit/implicit moderator is unlikely to change practice much.
- tractability: Nap-vs-wake designs with explicit and implicit SRTT variants and 24-h retest are routine and cheap, needing only a properly powered sample.
- evidence_gap: Older-adult nap studies split (c0013, c0040 vs c0010, c0050, c0079), but the meta-analysis in d1-05 reduces how uncertain the overall question really is.

</details>

### 10. In older adults, does fronto-central white matter integrity (corona radiata, corpus callosum on DTI) and motor-network grey matter volume moderate the motor consolidation benefit of a spindle- or slow-wave-targeting intervention (TMR, CLAS), so that only people with preserved structure respond?

`g09` · signal: newly-tractable · score 72 (novelty 3, importance 3, tractability 2, evidence gap 4)

Structural MRI explains a lot of the age-related loss in sleep oscillations: white matter integrity predicts frontal fast-spindle loss and moderates whether spindles support overnight motor consolidation (c0036, c0037). Grey matter loss in motor cortex and striatum mediates reduced nap delta (c0092). Sufficient motor-network activation appears necessary for sleep-facilitated consolidation (c0015). Recent older-adult TMR and tACS trials were null on average (c0022, c0027, c0052) but did not stratify by structure. Neuroimaging combined with closed-loop sleep manipulation now makes it testable whether the null results hide structure-dependent responders.

**Evidence it rests on**

- white matter integrity *associated* sleep spindle (experiment, older adults, DTI): "The magnitude of the loss of frontal fast sleep spindles in older adults was predicted by the degree of reduced white matter integrity" White Matter Structure in Older Adults Moderates the Benefit of Sleep Spindles on Motor Memory Consolidation (2017) `doi:10.1523/jneurosci.3033-16.2017`
- white matter integrity *other* sleep-dependent consolidation (experiment, older adults, DTI, moderation of spindle benefit): "the structural integrity of selective white matter fiber tracts, specifically within right posterior corona radiata, right tapetum, and bilateral corpus callosum, statistically moderates whether sleep spindles promoted overnight consolidation of motor skill memory" White Matter Structure in Older Adults Moderates the Benefit of Sleep Spindles on Motor Memory Consolidation (2017) `doi:10.1523/jneurosci.3033-16.2017`
- grey matter volume *associated* nap oscillatory activity (experiment, older adults, midday nap after motor sequencing task): "Delta reductions in older adults were mediated by grey matter loss in frontal medial cortex, primary motor cortex, thalamus, caudate, putamen, and pallidum" Ageing‐related changes in nap neuroscillatory activity are mediated and moderated by grey matter volume (2021) `doi:10.1111/ejn.15468`
- motor network activation *enables* sleep-dependent consolidation (experiment, healthy older adults, fMRI): "sufficient activation in a motor-related network appears to be necessary to trigger sleep-facilitated consolidation in older adults" Cerebral Activation During Initial Motor Learning Forecasts Subsequent Sleep-Facilitated Memory Consolidation in Older Adults (2016) `doi:10.1093/cercor/bhv347`
- transcranial alternating current stimulation *no-effect* motor memory consolidation (experiment, n=26, healthy older adults, nap): "spindle-inspired tACS, as used in the present study, did not enhance either spindles or memory consolidation" Impact of spindle-inspired transcranial alternating current stimulation during a nap on sleep-dependent motor memory consolidation in healthy older adults (2025) `doi:10.1093/sleepadvances/zpaf022`
- targeted memory reactivation *no-effect* motor memory consolidation (experiment, n=40, Parkinson's disease and healthy older adults, 2-h nap): "Results showed no effect of TMR on motor retention or dual-tasking, with no difference between the groups." Targeted memory reactivation during sleep modulates spindle and slow wave density, but not motor memory consolidation, in Parkinson’s disease (2026) `doi:10.64898/2026.04.22.26351552`
- targeted memory reactivation *no-effect* motor memory consolidation (experiment, n=17, older adults, post-learning nap): "older adults do not benefit from specific reactivation of a motor memory trace by an associated auditory cue" Targeted memory reactivation during post‐learning sleep does not enhance motor memory consolidation in older adults (2023) `doi:10.1111/jsr.14027`

**Disprover:** 10 searches across openalex, pubmed, europepmc, clinicaltrials, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- Linking TMR-induced changes in sleep oscillations and motor consolidation to diffusion-MRI microstructure has begun in a 2026 preprint; whether its sample is older adults was not confirmed. Thalamo-cortical white matter has already been shown to support motor consolidation through sleep spindles in young and older adults. The novelty that remains is stratifying responders to CLAS/TMR by structure, specifically in older adults. (Modulating Sleep Oscillations Through Targeted Memory Reactivation: Linking Functional Dynamics to Brain Microstructure `doi:10.64898/2026.10.13.758910`; Thalamo-Cortical White Matter Underlies Motor Memory Consolidation via Modulation of Sleep Spindles in Young and Older Adults (2019) `doi:10.1016/j.neuroscience.2018.12.049`)

<details><summary>Score rationale</summary>

- novelty: A 2026 preprint already links TMR-induced oscillation and consolidation changes to diffusion MRI, and thalamo-cortical white matter has been shown to support spindle-mediated consolidation in older adults (d1-08); stratifying CLAS/TMR responders by structure in older adults remains open.
- importance: Finding structure-dependent responders would explain the null intervention trials and allow targeted enrolment, but it mainly refines how trials are designed rather than establishing an effect.
- tractability: Detecting moderation of an intervention effect needs samples far larger than the n=17-40 TMR/tACS trials (c0022, c0027, c0052), plus MRI and sleep manipulation, which makes a decisive study expensive.
- evidence_gap: Moderation evidence is limited to observational spindle-consolidation links (c0036, c0037, c0092), and no intervention trial has stratified by structure.

</details>

### 11. In older adults learning a gross-motor ballistic skill (e.g., dart throwing), does overnight sleep reduce 24-h retention compared with an equal daytime wake interval, and is any loss associated with N3 slow-wave activity rather than spindles?

`g11` · signal: contradiction · score 72 (novelty 3, importance 2, tractability 4, evidence gap 3)

One study (n=60 older adults) reported that nocturnal sleep harmed dart-throwing retention in older adults, the only claim of a negative sleep effect on motor memory (c0096). In contrast, whole-hand and gross-motor sequence tasks restored or showed sleep-related gains (c0081, c0107). A separate nap study found that entering SWS was linked to worse visuomotor maze performance (c0114). A harmful effect of sleep has not been replicated, and the sleep stage behind it has not been measured with PSG.

**Evidence it rests on**

- sleep *decreases* motor memory retention (experiment, n=60, older adults, dart-throwing task): "our findings suggest that nocturnal sleep harms retention in older adults" The Effects of the Nocturnal Sleep on Learning of a Complex Motor Skill in Young and Older Adults (2024) `doi:10.1080/0361073x.2024.2439741`
- sleep *no-effect* motor memory consolidation (experiment, n=120, young and older adults, dart-throwing task): "Sleep did not enhance motor learning for any group" The Effects of the Nocturnal Sleep on Learning of a Complex Motor Skill in Young and Older Adults (2024) `doi:10.1080/0361073x.2024.2439741`
- aging *decreases* motor relearning (experiment, n=120, young vs older adults, dart-throwing task): "Older adults demonstrated inferior relearning compared to young adults, independently of sleep" The Effects of the Nocturnal Sleep on Learning of a Complex Motor Skill in Young and Older Adults (2024) `doi:10.1080/0361073x.2024.2439741`
- whole-hand motor task *enables* motor memory consolidation (experiment, older adults, overnight sleep): "when tested with an adapted sequence learning task, in which movements were performed with the whole hand, sleep-dependent motor improvement was observed in older adults" Sleep-dependent motor memory consolidation in older adults depends on task demands (2014) `doi:10.1016/j.neurobiolaging.2014.12.014`
- aging *decreases* motor memory consolidation (experiment, n=173, older vs younger adults, gross motor sequence task): "Younger adults showed greater overnight performance improvements than older adults." Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`
- slow-wave sleep *decreases* procedural memory consolidation (experiment, 60-min daytime nap, visuo-motor marble maze): "For nappers, the absence of SWS resulted in noticeable performance enhancements compared to participants who entered SWS." The Effects of Self-Guided Meditation and Napping on Memory Consolidation in Humans (2020) `doi:10.31237/osf.io/8t9uq`

**Disprover:** 10 searches across openalex, pubmed, europepmc, arxiv, clinicaltrials; no work found that answers it.

**Caveats raised by the disprover**

- The 'nocturnal sleep harms retention' claim comes from a design where the SLEEP group practised in the evening and was retested next morning, while CONTROL practised in the morning and was retested that evening. Sleep is fully confounded with time of training and testing, which the Pan & Rickard meta-analysis (c0038/c0039) lists as a strong moderator. A same-paradigm dart-throwing study in 60 adults (Motriz 2022, age not stated in what I saw) also tested nocturnal sleep on retention, adaptability and relearning. The gap frames this as a sleep-versus-wake contradiction. It should first be framed as needing a time-of-day-controlled replication (for example 24-h designs or counterbalanced AM/PM) before any N3-versus-spindle mechanism is studied. (The Effects of the Nocturnal Sleep on Learning of a Complex Motor Skill in Young and Older Adults (2024) `doi:10.1080/0361073x.2024.2439741`; The role of nocturnal sleep on the retention, adaptability, and relearning rate of a motor skill `doi:10.1590/s1980-657420220017221`; Sleep and motor learning: Is there room for consolidation? (2015) `doi:10.1037/bul0000009`)

<details><summary>Score rationale</summary>

- novelty: No time-of-day-controlled replication was found, but d1-10 shows the 'sleep harms' claim (c0096) is fully confounded with training and testing time, and a similar dart-throwing study exists, so the gap is mis-framed and loses a point.
- importance: The headline finding probably reflects a time-of-day confound, so a replication would mostly remove an outlier claim rather than change understanding; the N3-vs-spindle mechanism question is premature until then.
- tractability: A counterbalanced AM/PM or 24-h dart-throwing design with ambulatory PSG is simple and cheap.
- evidence_gap: The harm claim rests on one confounded study (c0096) and an indirect nap-SWS finding on a different task (c0114), against null or positive gross-motor results (c0095, c0107); the evidence is thin but its weakness is already understood.

</details>

### 12. In healthy adults aged 60-85, does pharmacological REM suppression (e.g., a single SSRI/SNRI dose) after motor sequence or mirror-tracing training, compared with placebo, reduce overnight procedural gains, while N2 spindle density is held constant?

`g12` · signal: weak-evidence · score 36 (novelty 2, importance 3, tractability 2, evidence gap 3)

Reviews assign procedural consolidation to REM sleep and say REM-related procedural consolidation is impaired in older adults (c0005, c0058). The only direct evidence in older people is a 2003 correlation between REM% and procedural learning (c0113). Meanwhile, recent older-adult studies point to N2/N3 fast spindles instead (c0035, c0108). No study in this set manipulates REM in older adults to test whether it is causally necessary for procedural consolidation as distinct from NREM spindles.

**Evidence it rests on**

- rem sleep *increases* procedural memory consolidation (review): "Slow wave sleep (SWS) particularly enhances declarative memories whereas rapid eye movement (REM) sleep preferentially supports procedural and emotional memory aspects." The whats and whens of sleep-dependent memory consolidation. (2009) `doi:10.1016/j.smrv.2008.08.002`
- aging *decreases* procedural memory consolidation (review, older adults): "processes of procedural memory consolidation during REM sleep as well as declarative memory consolidation during slow wave sleep are impaired in older adults" Sleep and memory consolidation in the elderly (2009) `doi:10.1055/s-0029-1240138`
- rem sleep *associated* procedural learning (rct, n=33, healthy older adults aged 60-85): "the percentage of REM-sleep during the study night correlates significantly only with the procedural learning task but not with the declarative one" Does REM-sleep manipulation have a differential effect on learning and memory in healthy older adults? (2004) `doi:10.1055/s-2003-825382`
- sleep spindle *associated* motor memory consolidation (experiment, older adults, frontal fast spindles): "with the extent of impairment being associated with the degree of reduced frontal fast sleep spindle density" White Matter Structure in Older Adults Moderates the Benefit of Sleep Spindles on Motor Memory Consolidation (2017) `doi:10.1523/jneurosci.3033-16.2017`
- fast sleep spindle *associated* motor memory consolidation (experiment, n=173, older and younger adults, N3 sleep, ambulatory PSG): "only fast spindle density during N3 sleep significantly predicted motor memory consolidation" Age-related decline in gross motor memory : the role of slow oscillations-spindle coupling (2025) `openalex:W7171340689`
- sleep duration *associated* procedural memory consolidation (review): "Procedural memory profits seem more dose-dependent on the amount of sleep following the day after learning." The whats and whens of sleep-dependent memory consolidation. (2009) `doi:10.1016/j.smrv.2008.08.002`

**Disprover:** 10 searches across pubmed, openalex, europepmc, clinicaltrials, arxiv; no work found that answers it.

**Caveats raised by the disprover**

- The proposed manipulation has already been done in young adults. SSRI/SNRI REM suppression after training did not impair finger-tapping consolidation; it enhanced accuracy gains together with sleep spindles. The authors concluded REM as a unitary state is not required for skill consolidation. Because these drugs raise spindles, the design condition 'N2 spindle density held constant' cannot be met with the suggested drug class, so the design is partly mis-stated. Other drug studies separate the cholinergic component: the anticholinergic antidepressant amitriptyline had differential effects on sleep-dependent memory consolidation, and combined cholinergic receptor blockade during REM-rich sleep impaired offline motor consolidation. Only an older-adult-specific test with a non-spindle-enhancing manipulation would remain novel. (Pharmacological REM sleep suppression paradoxically improves rather than impairs skill memory `doi:10.1038/nn.2206`; Differential Effect of an Anticholinergic Antidepressant on Sleep-Dependent Memory Consolidation `doi:10.5665/sleep.3674`; Impaired Off-Line Consolidation of Motor Memories After Combined Blockade of Cholinergic Receptors During REM Sleep-Rich Sleep `doi:10.1038/npp.2009.6`)

<details><summary>Score rationale</summary>

- novelty: SSRI/SNRI REM suppression after finger-tapping training has been tested in young adults, with no impairment and enhanced spindles, and cholinergic-blockade studies exist (d1-11); only an older-adult test with a non-spindle-enhancing manipulation would be new.
- importance: A causal test of REM against NREM spindles in older adults would settle a long-running theoretical claim (c0005, c0058), but young-adult data already argue against a necessary REM role.
- tractability: The proposed drug class raises spindles, so 'spindle density held constant' cannot be met (d1-11), and giving REM-suppressing drugs to people aged 60-85 adds safety and confound problems.
- evidence_gap: Direct older-adult REM evidence is one 2003 correlation (c0113), but the young-adult manipulations and the spindle findings (c0035, c0108) already tilt the evidence away from REM.

</details>

## How this was produced

scope → (human picked paper count) → fetch + claim extraction → code signals + gap proposals → independent disprover (read-only, web + databases) ⇄ author drop/rebut → citation gate (no LLM) → ranking. Every id above resolved in a live database or was fetched in this run; every quote was matched against its abstract by code. Raw data: `gaps.json`, `claims.jsonl`, `proof/`.
