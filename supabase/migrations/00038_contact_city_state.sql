-- 00038_contact_city_state.sql
-- Add city + state to contacts and backfill from seed data.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS state text;

-- Backfill batch 1 (EV Construction contacts)
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Erik Butzer' AND city IS NULL;
UPDATE contacts SET city='Grand Haven', state='MI' WHERE name='Noah Burtovoy' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Madelyn Gagnon' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Jordan Gougeon' AND city IS NULL;
UPDATE contacts SET city='Holland', state='MI' WHERE name='Jared Andersen' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Nick Novakoski' AND city IS NULL;
UPDATE contacts SET city='Jenison', state='MI' WHERE name='Curt Hielke' AND city IS NULL;
UPDATE contacts SET city='Grand Haven', state='MI' WHERE name='Scott McConnelee' AND city IS NULL;
UPDATE contacts SET city='Holland', state='MI' WHERE name='Charlie Bennett' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Judd VanBergen' AND city IS NULL;
-- Rycon
UPDATE contacts SET city='Pittsburgh', state='PA' WHERE name='Brandon Rupert' AND city IS NULL;
UPDATE contacts SET city='Pittsburgh', state='PA' WHERE name='Toni Peitz' AND city IS NULL;
UPDATE contacts SET city='Fort Lauderdale', state='FL' WHERE name='Bryan Baswell' AND city IS NULL;
UPDATE contacts SET city='Houston', state='TX' WHERE name='Christopher Sosa' AND city IS NULL;
UPDATE contacts SET city='Atlanta', state='GA' WHERE name='Zachary Sims' AND city IS NULL;
UPDATE contacts SET city='Pittsburgh', state='PA' WHERE name='Kristopher Brice' AND city IS NULL;
UPDATE contacts SET city='Missouri City', state='TX' WHERE name='R. Scott Crain' AND city IS NULL;
UPDATE contacts SET city='Atlanta', state='GA' WHERE name='Dylan John' AND city IS NULL;
UPDATE contacts SET city='Amherst', state='OH' WHERE name='Mark Pavlich' AND city IS NULL;
UPDATE contacts SET city='South Park Township', state='PA' WHERE name='Halie Girgash' AND city IS NULL;
-- MAPP
UPDATE contacts SET city='Dallas-Fort Worth', state='TX' WHERE name='Trevor Davis' AND city IS NULL;
UPDATE contacts SET city='Dallas', state='TX' WHERE name='Ethan Perry' AND city IS NULL;
UPDATE contacts SET city='Dallas', state='TX' WHERE name='Charles Barham' AND city IS NULL;
UPDATE contacts SET city='Baton Rouge', state='LA' WHERE name='Ken Gardner' AND city IS NULL;
UPDATE contacts SET city='Baton Rouge', state='LA' WHERE name='David Talbot' AND city IS NULL;
UPDATE contacts SET city='Dallas', state='TX' WHERE name='Curtis Walker' AND city IS NULL;
UPDATE contacts SET city='Dallas-Fort Worth', state='TX' WHERE name='Daniel Kinard' AND city IS NULL;
UPDATE contacts SET city='Baton Rouge', state='LA' WHERE name='Andrew Hill' AND city IS NULL;
UPDATE contacts SET city='Dallas-Fort Worth', state='TX' WHERE name='Chris Hale' AND city IS NULL;
UPDATE contacts SET city='Dallas', state='TX' WHERE name='Wade L.' AND city IS NULL;
-- Excel
UPDATE contacts SET city='Shawnee', state='KS' WHERE name='Troy Bechtel' AND city IS NULL;
UPDATE contacts SET city='Shawnee', state='KS' WHERE name='Russ Befort' AND city IS NULL;
UPDATE contacts SET city='Overland Park', state='KS' WHERE name='Kara Dold' AND city IS NULL;
UPDATE contacts SET city='Seabrook', state='TX' WHERE name='Terral Evans' AND city IS NULL;
UPDATE contacts SET city='Baton Rouge', state='LA' WHERE name='Jackie Sharp' AND city IS NULL;
UPDATE contacts SET city='Houston', state='TX' WHERE name='Allan Obando' AND city IS NULL;
-- Eleven Western
UPDATE contacts SET city='Los Angeles', state='CA' WHERE name='Cameron Delahoussaye' AND city IS NULL;
UPDATE contacts SET city='San Diego', state='CA' WHERE name='Alex Gabrielson' AND city IS NULL;
UPDATE contacts SET city='Encinitas', state='CA' WHERE name='Shayne Martella' AND city IS NULL;
UPDATE contacts SET city='Ramona', state='CA' WHERE name='Ethan Lundgren' AND city IS NULL;
UPDATE contacts SET city='Escondido', state='CA' WHERE name='John Van Hovel' AND city IS NULL;
UPDATE contacts SET city='Escondido', state='CA' WHERE name='Ruben Marquez' AND city IS NULL;
UPDATE contacts SET city='Los Angeles', state='CA' WHERE name='Karlo Munoz' AND city IS NULL;
UPDATE contacts SET city='Fontana', state='CA' WHERE name='Hugo Mejia' AND city IS NULL;
UPDATE contacts SET city='Los Angeles', state='CA' WHERE name='Adam Yeager' AND city IS NULL;
UPDATE contacts SET city='Boise', state='ID' WHERE name='Kyle Kolloff' AND city IS NULL;
-- Stansell
UPDATE contacts SET city='Atlanta', state='GA' WHERE name='Greg Tertichny' AND city IS NULL;
UPDATE contacts SET city='Tampa Bay', state='FL' WHERE name='Parker Ronchetto' AND city IS NULL;
UPDATE contacts SET city='Biloxi', state='MS' WHERE name='Daniel Normand' AND city IS NULL;
UPDATE contacts SET city='Atlanta', state='GA' WHERE name='Cody Winn' AND city IS NULL;
UPDATE contacts SET city='Lithia', state='FL' WHERE name='Derek Herron' AND city IS NULL;
UPDATE contacts SET city='Dade City', state='FL' WHERE name='Micah Sieben' AND city IS NULL;
UPDATE contacts SET city='Red Oak', state='TX' WHERE name='Bryan Crews' AND city IS NULL;
UPDATE contacts SET city='Hudson', state='FL' WHERE name='Shawn Abel' AND city IS NULL;
UPDATE contacts SET city='Lake Dallas', state='TX' WHERE name='Rex Middleton' AND city IS NULL;
UPDATE contacts SET city='Hickory', state='NC' WHERE name='Dillon Brophy' AND city IS NULL;
-- Shores
UPDATE contacts SET city='Centralia', state='IL' WHERE name='Drew Shores' AND city IS NULL;
UPDATE contacts SET city='Ashley', state='IL' WHERE name='Clint Johannes' AND city IS NULL;

-- Batch 2: Fortney & Weygandt
UPDATE contacts SET city='Brunswick', state='OH' WHERE name='Matthew Pell' AND city IS NULL;
UPDATE contacts SET city='Broadview Heights', state='OH' WHERE name='John Kozlowski' AND city IS NULL;
UPDATE contacts SET city='Avon', state='OH' WHERE name='Jessie Krisanda' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Danielle James' AND city IS NULL;
UPDATE contacts SET city='Medina', state='OH' WHERE name='Joseph Arena' AND city IS NULL;
UPDATE contacts SET city='Mentor', state='OH' WHERE name='Jackie Bruce' AND city IS NULL;
UPDATE contacts SET city='Lakewood', state='OH' WHERE name='Dave Jerkins' AND city IS NULL;
UPDATE contacts SET city='Strongsville', state='OH' WHERE name='Jude Siefker' AND city IS NULL;
UPDATE contacts SET city='Akron', state='OH' WHERE name='Dave Conrad' AND city IS NULL;
-- Tricon
UPDATE contacts SET city='Chattanooga', state='TN' WHERE name='Jeremiah Phelps' AND city IS NULL;
-- ARCO/Murray
UPDATE contacts SET city='New York', state='NY' WHERE name='Lawrence Slocum' AND city IS NULL;
UPDATE contacts SET city='Chicago', state='IL' WHERE name='Diaa Masoud' AND city IS NULL;
UPDATE contacts SET city='Dallas', state='TX' WHERE name='Alena Denisova' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Mark Casper' AND city IS NULL;
UPDATE contacts SET city='Chicago', state='IL' WHERE name='Ali Hani' AND city IS NULL;
UPDATE contacts SET city='Dallas', state='TX' WHERE name='Bryan Grigsby Jr' AND city IS NULL;
UPDATE contacts SET city='Chicago', state='IL' WHERE name='Josh Przyborowski' AND city IS NULL;
UPDATE contacts SET city='Chicago', state='IL' WHERE name='Katelyn Wujciga' AND city IS NULL;
-- Diamond
UPDATE contacts SET city='Blue Springs', state='MO' WHERE name='Derek Noland' AND city IS NULL;
UPDATE contacts SET city='Lees Summit', state='MO' WHERE name='Shawn Noland' AND city IS NULL;
UPDATE contacts SET city='Lees Summit', state='MO' WHERE name='Alexandra Nolker' AND city IS NULL;
UPDATE contacts SET city='Kansas City', state='MO' WHERE name='Savannah Etter' AND city IS NULL;
UPDATE contacts SET city='Houston', state='TX' WHERE name='Briana Church' AND city IS NULL;
UPDATE contacts SET city='Oklahoma City', state='OK' WHERE name='Mallory Griffith' AND city IS NULL;
UPDATE contacts SET city='Kansas City', state='MO' WHERE name='Trina Arvayo' AND city IS NULL;
-- Prime Retail
UPDATE contacts SET city='Flowery Branch', state='GA' WHERE name='Celene Eichler' AND city IS NULL;
UPDATE contacts SET city='Flowery Branch', state='GA' WHERE name='Jonathan McLendon' AND city IS NULL;
UPDATE contacts SET city='Lake St Louis', state='MO' WHERE name='Mike Grayson' AND city IS NULL;
UPDATE contacts SET city='Denison', state='TX' WHERE name='Krystia Sparks' AND city IS NULL;
UPDATE contacts SET city='Lawrenceville', state='GA' WHERE name='Jelena Ilic' AND city IS NULL;
UPDATE contacts SET city='Cumming', state='GA' WHERE name='Kalli Shay' AND city IS NULL;
UPDATE contacts SET city='Gainesville', state='GA' WHERE name='Reid Clark' AND city IS NULL;
UPDATE contacts SET city='Duluth', state='GA' WHERE name='Lucas Grandkoski' AND city IS NULL;
UPDATE contacts SET city='Cornelia', state='GA' WHERE name='Gloria Chandler' AND city IS NULL;
-- HNB
UPDATE contacts SET city='Baltimore', state='MD' WHERE name='Tom Brennan' AND city IS NULL;
UPDATE contacts SET city='Baltimore', state='MD' WHERE name='Katie Webster' AND city IS NULL;
UPDATE contacts SET city='Lutherville-Timonium', state='MD' WHERE name='Samantha Schwartz-Jones' AND city IS NULL;
-- Marcus
UPDATE contacts SET city='Willmar', state='MN' WHERE name='Eli Gunderson' AND city IS NULL;
UPDATE contacts SET city='Willmar', state='MN' WHERE name='Jesse Ellingson' AND city IS NULL;
UPDATE contacts SET city='Willmar', state='MN' WHERE name='Steven Wetterling' AND city IS NULL;
UPDATE contacts SET city='St Cloud', state='MN' WHERE name='Andy Neis' AND city IS NULL;
UPDATE contacts SET city='Willmar', state='MN' WHERE name='Micheal Lehner' AND city IS NULL;
UPDATE contacts SET city='New London', state='MN' WHERE name='Travis Roediger' AND city IS NULL;
UPDATE contacts SET city='St Cloud', state='MN' WHERE name='Justin Chvala' AND city IS NULL;
UPDATE contacts SET city='Mankato', state='MN' WHERE name='Blake Karsch' AND city IS NULL;

-- Batch 3: Sachse
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Mark Andonian' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Brad Miller' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Rick Stanza' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Mike Eberhardt' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Antoinette Miller' AND city IS NULL;
UPDATE contacts SET city='Ann Arbor', state='MI' WHERE name='Amogh Doijad' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Matt Terman' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Tony Ciciretto' AND city IS NULL;
-- Wolverine
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Randy Baker' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Matt Heitz' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Daniel Zilzer' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Bryan Richardson' AND city IS NULL;
UPDATE contacts SET city='Lansing', state='MI' WHERE name='Cyrus Brandenburg' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Jonathan Reimink' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='John Lafrinere' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='David Paquet' AND city IS NULL;
-- Wolgast
UPDATE contacts SET city='Saginaw', state='MI' WHERE name='Eric Schwartzly' AND city IS NULL;
UPDATE contacts SET city='Saginaw', state='MI' WHERE name='Joshua Lakie' AND city IS NULL;
UPDATE contacts SET city='Saginaw', state='MI' WHERE name='Amber Swanson' AND city IS NULL;
UPDATE contacts SET city='Vermontville', state='MI' WHERE name='Jim Venton' AND city IS NULL;
UPDATE contacts SET city='Saginaw', state='MI' WHERE name='Greg Stadler' AND city IS NULL;
UPDATE contacts SET city='Bay City', state='MI' WHERE name='Vince Drumright' AND city IS NULL;
UPDATE contacts SET city='Shepherd', state='MI' WHERE name='Craig Myers' AND city IS NULL;
UPDATE contacts SET city='Hemlock', state='MI' WHERE name='Justin Schroeder' AND city IS NULL;
-- J.S. Vig
UPDATE contacts SET city='Plymouth', state='MI' WHERE name='Brett Levko' AND city IS NULL;
-- Roncelli
UPDATE contacts SET city='Auburn Hills', state='MI' WHERE name='Jim Carnacchi' AND city IS NULL;
UPDATE contacts SET city='Sterling Heights', state='MI' WHERE name='Bill Palazzolo' AND city IS NULL;
UPDATE contacts SET city='Clarkston', state='MI' WHERE name='Steven Holtcamp' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Ted Shekell' AND city IS NULL;
UPDATE contacts SET city='Harrison Township', state='MI' WHERE name='Michael Herbon' AND city IS NULL;
UPDATE contacts SET city='Macomb', state='MI' WHERE name='Christian Contarino' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Justin Bott' AND city IS NULL;
UPDATE contacts SET city='Clarkston', state='MI' WHERE name='Matt Mellen' AND city IS NULL;
UPDATE contacts SET city='Livonia', state='MI' WHERE name='Jay Thomas' AND city IS NULL;
-- Jarbou Ronnisch
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Michael Phillips' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Hunter Taylor' AND city IS NULL;
UPDATE contacts SET city='Clarkston', state='MI' WHERE name='David Dourjalian' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Garrett Dulecki' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Richard Polan' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Andrew Di Dio' AND city IS NULL;
UPDATE contacts SET city='Troy', state='MI' WHERE name='Tyler Gabor' AND city IS NULL;
UPDATE contacts SET city='South Lyon', state='MI' WHERE name='Armen Derderian' AND city IS NULL;
-- Clark Construction Company
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Bud Provenzano' AND city IS NULL;
UPDATE contacts SET city='Grand Rapids', state='MI' WHERE name='Andrew Bourgois' AND city IS NULL;
UPDATE contacts SET city='Battle Creek', state='MI' WHERE name='Allison Clark' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Chad Thelen' AND city IS NULL;
UPDATE contacts SET city='Canton', state='MI' WHERE name='Matt Wielechowski' AND city IS NULL;
UPDATE contacts SET city='Lansing', state='MI' WHERE name='Chris Martin' AND city IS NULL;
UPDATE contacts SET city='Waterford', state='MI' WHERE name='Ryan Wenzel' AND city IS NULL;
-- Oliver / Hatcher
UPDATE contacts SET city='Novi', state='MI' WHERE name='Christian Laycock' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Michael Schumacher' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Pooja Patil' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Jennifer Rose' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='Derek Dobias' AND city IS NULL;
UPDATE contacts SET city='Berkley', state='MI' WHERE name='Dan O''Donnell' AND city IS NULL;
UPDATE contacts SET city='Detroit', state='MI' WHERE name='John Ruttkofsky' AND city IS NULL;
-- AUCH
UPDATE contacts SET city='Port Huron', state='MI' WHERE name='Gerry McClelland' AND city IS NULL;
UPDATE contacts SET city='Livonia', state='MI' WHERE name='Matthew Wiemer' AND city IS NULL;
UPDATE contacts SET city='Southfield', state='MI' WHERE name='Robert Berryman' AND city IS NULL;
UPDATE contacts SET city='Grand Blanc', state='MI' WHERE name='Jim Chernosky' AND city IS NULL;
UPDATE contacts SET city='Highland', state='MI' WHERE name='Scott Oswald' AND city IS NULL;
UPDATE contacts SET city='Commerce', state='MI' WHERE name='M. Tyler Maki' AND city IS NULL;
UPDATE contacts SET city='Waterford', state='MI' WHERE name='Aaron St. Dennis' AND city IS NULL;
UPDATE contacts SET city='Rochester', state='MI' WHERE name='Jacob Munchiando' AND city IS NULL;

-- Batch 4: Construction One
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Bob Dech' AND city IS NULL;
UPDATE contacts SET city='Vinita', state='OK' WHERE name='Sadie Salerno' AND city IS NULL;
UPDATE contacts SET city='Chillicothe', state='OH' WHERE name='Este Moraleja' AND city IS NULL;
UPDATE contacts SET city='Pataskala', state='OH' WHERE name='Travis Weed' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Mark Shy' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Erich Harshbarger' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Jacob Krum' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Mark Quisenberry' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Patrick Corbett' AND city IS NULL;
-- Cleveland Construction
UPDATE contacts SET city='Mentor', state='OH' WHERE name='Randy Stoops' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Clint McCurdy' AND city IS NULL;
UPDATE contacts SET city='Cincinnati', state='OH' WHERE name='Philip Kristoff' AND city IS NULL;
UPDATE contacts SET city='Charlotte', state='NC' WHERE name='Mike Ugrinic' AND city IS NULL;
UPDATE contacts SET city='Mentor', state='OH' WHERE name='Ray Kriz' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Matt Onslow' AND city IS NULL;
UPDATE contacts SET city='Uniontown', state='OH' WHERE name='Seth Daniels' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='David Allchin' AND city IS NULL;
-- Panzica
UPDATE contacts SET city='Grafton', state='OH' WHERE name='Ryan Hamilton' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Bill O''Hare' AND city IS NULL;
UPDATE contacts SET city='Avon Lake', state='OH' WHERE name='Steve Nock' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Patrick Conochan' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Gerald Federan' AND city IS NULL;
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Ashley Lanphear' AND city IS NULL;
-- Ruscilli
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Robert Minshall' AND city IS NULL;
UPDATE contacts SET city='Hilliard', state='OH' WHERE name='Michael Mancini' AND city IS NULL;
UPDATE contacts SET city='Plain City', state='OH' WHERE name='Jon Belviso' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Nathaniel Clark' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Rakesh Kalyan' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Britney Clemans' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='David Cunningham' AND city IS NULL;
UPDATE contacts SET city='Dublin', state='OH' WHERE name='Shannon Brown' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Todd Moroz' AND city IS NULL;
-- Elford
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Carlo Burns' AND city IS NULL;
UPDATE contacts SET city='Westerville', state='OH' WHERE name='Chad Morgan' AND city IS NULL;
UPDATE contacts SET city='Hilliard', state='OH' WHERE name='Christopher Italiano' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Matt Kemme' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Chris Conrad' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Rohan Bhat' AND city IS NULL;
UPDATE contacts SET city='Grove City', state='OH' WHERE name='Justin Flores' AND city IS NULL;
-- Setterlin
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Marc Graf' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Jordan Spano' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Andrew Currie' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Justin Metzler' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Scott Forshey' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Adam Crabtree' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Striker Loudermilk' AND city IS NULL;
UPDATE contacts SET city='Columbus', state='OH' WHERE name='Michael Shean' AND city IS NULL;
UPDATE contacts SET city='Lewis Center', state='OH' WHERE name='Scott Forshey' AND city IS NULL;
-- Skoda
UPDATE contacts SET city='Cleveland', state='OH' WHERE name='Michael Skoda' AND city IS NULL;
