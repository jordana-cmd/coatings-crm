-- 00035_contact_linkedin.sql
-- Add linkedin_url to contacts (nullable text).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Backfill linkedin URLs from the seed data (batch 1 + batch 2).
-- Batch 1: EV Construction
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/erik-butzer-991b2b159/' WHERE name = 'Erik Butzer' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/noah-burtovoy-3747a1239/' WHERE name = 'Noah Burtovoy' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/madelyn-gagnon-67b222217/' WHERE name = 'Madelyn Gagnon' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jordan-gougeon/' WHERE name = 'Jordan Gougeon' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jared-andersen-chc-69a732129/' WHERE name = 'Jared Andersen' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/nick-novakoski-mba-01b67986/' WHERE name = 'Nick Novakoski' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/curt-hielke-351639133/' WHERE name = 'Curt Hielke' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/scott-mcconnelee-452a9519/' WHERE name = 'Scott McConnelee' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/charlesbennett-cm/' WHERE name = 'Charlie Bennett' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/judd-vanbergen-a38377173/' WHERE name = 'Judd VanBergen' AND linkedin_url IS NULL;
-- Rycon
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/brandon-rupert-48639917/' WHERE name = 'Brandon Rupert' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/toni-peitz-1b063549/' WHERE name = 'Toni Peitz' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/bryan-baswell-leed-ap-906285b/' WHERE name = 'Bryan Baswell' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/christopher-sosa-01186498/' WHERE name = 'Christopher Sosa' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/zachary-sims-ab564ab8/' WHERE name = 'Zachary Sims' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/kristopherbrice/' WHERE name = 'Kristopher Brice' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/r-scott-crain-0a3a7010/' WHERE name = 'R. Scott Crain' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/dylan-john-georgiasouthern/' WHERE name = 'Dylan John' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/mark-pavlich-5351a561/' WHERE name = 'Mark Pavlich' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/halie-girgash-9435728b/' WHERE name = 'Halie Girgash' AND linkedin_url IS NULL;
-- MAPP
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/trevor-davis-mba-pmp-b0b077235/' WHERE name = 'Trevor Davis' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/ethanperry5/' WHERE name = 'Ethan Perry' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/charles-barham-76a33a23a/' WHERE name = 'Charles Barham' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/ken-gardner-a0130275/' WHERE name = 'Ken Gardner' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/david-talbot-53225560/' WHERE name = 'David Talbot' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/curtis-walker-02a28636/' WHERE name = 'Curtis Walker' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/daniel-kinard-4204a847/' WHERE name = 'Daniel Kinard' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/andrew-hill-266299b0/' WHERE name = 'Andrew Hill' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/chris-hale-b37b95163/' WHERE name = 'Chris Hale' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/wade-l-a819302/' WHERE name = 'Wade L.' AND linkedin_url IS NULL;
-- Excel
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/troy-bechtel-a414566/' WHERE name = 'Troy Bechtel' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/russ-befort-4413b652/' WHERE name = 'Russ Befort' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/kara-dold-628836137/' WHERE name = 'Kara Dold' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/terral-evans-2a5bb99a/' WHERE name = 'Terral Evans' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jackie-sharp-062345215/' WHERE name = 'Jackie Sharp' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/allan-obando-29b80811b/' WHERE name = 'Allan Obando' AND linkedin_url IS NULL;
-- Eleven Western
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/cameron-delahoussaye-307376188/' WHERE name = 'Cameron Delahoussaye' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/alex-gabrielson/' WHERE name = 'Alex Gabrielson' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/shayne-martella/' WHERE name = 'Shayne Martella' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/ethan-lundgren-mba-1153561a0/' WHERE name = 'Ethan Lundgren' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/john-van-hovel-b879ba24/' WHERE name = 'John Van Hovel' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/ruben-marquez-ii-4a777933/' WHERE name = 'Ruben Marquez' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/karlo-munoz-371447173/' WHERE name = 'Karlo Munoz' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/hugo-mejia-b0038382/' WHERE name = 'Hugo Mejia' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/adam-yeager-807731194/' WHERE name = 'Adam Yeager' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/kyle-kolloff-b98961129/' WHERE name = 'Kyle Kolloff' AND linkedin_url IS NULL;
-- Stansell
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/greg-tertichny-2ab44953/' WHERE name = 'Greg Tertichny' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/parker-ronchetto-047473157/' WHERE name = 'Parker Ronchetto' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/daniel-normand-4846a9102/' WHERE name = 'Daniel Normand' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/cody-winn-a9b6223b/' WHERE name = 'Cody Winn' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/derek-herron-8b5113164/' WHERE name = 'Derek Herron' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/micah-sieben-a05a2788/' WHERE name = 'Micah Sieben' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/bryan-crews-43615192/' WHERE name = 'Bryan Crews' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/shawn-abel-09455213/' WHERE name = 'Shawn Abel' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/rex-middleton-42b769129/' WHERE name = 'Rex Middleton' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/dillon-brophy-b02160b6/' WHERE name = 'Dillon Brophy' AND linkedin_url IS NULL;
-- Shores
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/stephen-drew-shores-189235131/' WHERE name = 'Drew Shores' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/clint-johannes-1b8307127/' WHERE name = 'Clint Johannes' AND linkedin_url IS NULL;
-- Batch 2: Fortney & Weygandt
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/matthew-pell-3b43a347/' WHERE name = 'Matthew Pell' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/john-kozlowski-b0391147/' WHERE name = 'John Kozlowski' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jessie-krisanda-b817a156/' WHERE name = 'Jessie Krisanda' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/danielle-carpenter-dpc/' WHERE name = 'Danielle James' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/joseph-arena-14a505123/' WHERE name = 'Joseph Arena' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jackie-bruce-1a626869/' WHERE name = 'Jackie Bruce' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/dave-jerkins-590a2059/' WHERE name = 'Dave Jerkins' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/michael-clemons-bbb1a6156/' WHERE name = 'Michael Clemons' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jude-siefker-42967b121/' WHERE name = 'Jude Siefker' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/dave-conrad-026b80102/' WHERE name = 'Dave Conrad' AND linkedin_url IS NULL;
-- Tricon
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jeremiah-phelps-16899770/' WHERE name = 'Jeremiah Phelps' AND linkedin_url IS NULL;
-- ARCO/Murray
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/lawrence-slocum-87774459/' WHERE name = 'Lawrence Slocum' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/diaa-masoud-pe/' WHERE name = 'Diaa Masoud' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/alena-denisova-pe/' WHERE name = 'Alena Denisova' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/mark-casper-a8566544/' WHERE name = 'Mark Casper' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/ali-hani-768b12109/' WHERE name = 'Ali Hani' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/bryan-grigsby-jr-1153931aa/' WHERE name = 'Bryan Grigsby Jr' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/ighetrify/' WHERE name = 'Ibrahem E.' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/josh-przyborowski-aa5860a/' WHERE name = 'Josh Przyborowski' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/katelyn-wujciga/' WHERE name = 'Katelyn Wujciga' AND linkedin_url IS NULL;
-- Diamond
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/derek-noland-a2b88889/' WHERE name = 'Derek Noland' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/shawn-noland-62517b70/' WHERE name = 'Shawn Noland' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/alexandra-nolker/' WHERE name = 'Alexandra Nolker' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/savannah-etter/' WHERE name = 'Savannah Etter' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/brianachurch/' WHERE name = 'Briana Church' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/mallory-griffith-5a8029148/' WHERE name = 'Mallory Griffith' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/trina-arvayo-4ba69138/' WHERE name = 'Trina Arvayo' AND linkedin_url IS NULL;
-- Prime Retail
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/celene-connell-314888120/' WHERE name = 'Celene Eichler' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jonathan-mclendon-4509189a/' WHERE name = 'Jonathan McLendon' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/mike-grayson-66a7543/' WHERE name = 'Mike Grayson' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/krystia-granger-sparks-0104433/' WHERE name = 'Krystia Sparks' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jelena-ilic-274b7421a/' WHERE name = 'Jelena Ilic' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/kalli-shay/' WHERE name = 'Kalli Shay' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/reid-clark-9b82a6239/' WHERE name = 'Reid Clark' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/lucas-grandkoski-16971a38/' WHERE name = 'Lucas Grandkoski' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/gloria-chandler-72170922a/' WHERE name = 'Gloria Chandler' AND linkedin_url IS NULL;
-- HNB
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/tom-brennan-46ba04377/' WHERE name = 'Tom Brennan' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/katherine-webster-87861570/' WHERE name = 'Katie Webster' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/samantha-schwartz-jones-71997657/' WHERE name = 'Samantha Schwartz-Jones' AND linkedin_url IS NULL;
-- Marcus
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/eli-gunderson-20bb87158/' WHERE name = 'Eli Gunderson' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/jesse-ellingson-8b8708207/' WHERE name = 'Jesse Ellingson' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/steven-wetterling-467b8052/' WHERE name = 'Steven Wetterling' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/andy-neis-b26b27184/' WHERE name = 'Andy Neis' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/micheal-lehner-779b85b4/' WHERE name = 'Micheal Lehner' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/travis-roediger-61120278/' WHERE name = 'Travis Roediger' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/joe-degrote-81046b95/' WHERE name = 'Joe DeGrote' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/justin-chvala-07503b152/' WHERE name = 'Justin Chvala' AND linkedin_url IS NULL;
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/blake-karsch-52112212a/' WHERE name = 'Blake Karsch' AND linkedin_url IS NULL;
