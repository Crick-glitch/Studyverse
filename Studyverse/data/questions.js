/**
 * StudyVerse Question Bank
 * 150+ questions across Math, Science, History, Language, Biology, Other
 * Each entry: { id, subject, difficulty, text, choices: [3 items], correctIndex }
 */
window.QUESTION_BANK = [

  /* ─────────────── MATH – EASY ─────────────── */
  { id:"math-e-001", subject:"Math", difficulty:"easy", text:"What is 6 × 7?", choices:["42","48","36"], correctIndex:0 },
  { id:"math-e-002", subject:"Math", difficulty:"easy", text:"What is 144 ÷ 12?", choices:["13","12","11"], correctIndex:1 },
  { id:"math-e-003", subject:"Math", difficulty:"easy", text:"What is 15% of 200?", choices:["30","25","35"], correctIndex:0 },
  { id:"math-e-004", subject:"Math", difficulty:"easy", text:"What is the square root of 81?", choices:["7","9","8"], correctIndex:1 },
  { id:"math-e-005", subject:"Math", difficulty:"easy", text:"What is 2³?", choices:["6","9","8"], correctIndex:2 },
  { id:"math-e-006", subject:"Math", difficulty:"easy", text:"What is 100 − 37?", choices:["63","73","53"], correctIndex:0 },
  { id:"math-e-007", subject:"Math", difficulty:"easy", text:"What is 9 × 9?", choices:["81","72","91"], correctIndex:0 },
  { id:"math-e-008", subject:"Math", difficulty:"easy", text:"How many sides does a hexagon have?", choices:["5","6","7"], correctIndex:1 },
  { id:"math-e-009", subject:"Math", difficulty:"easy", text:"What is 3/4 expressed as a decimal?", choices:["0.34","0.75","0.7"], correctIndex:1 },
  { id:"math-e-010", subject:"Math", difficulty:"easy", text:"What is the perimeter of a square with side 5?", choices:["25","20","15"], correctIndex:1 },

  /* ─────────────── MATH – MEDIUM ─────────────── */
  { id:"math-m-001", subject:"Math", difficulty:"medium", text:"What is 12 × 13?", choices:["156","144","168"], correctIndex:0 },
  { id:"math-m-002", subject:"Math", difficulty:"medium", text:"Solve: 3x + 7 = 22. What is x?", choices:["4","5","6"], correctIndex:1 },
  { id:"math-m-003", subject:"Math", difficulty:"medium", text:"What is the area of a circle with radius 7? (Use π ≈ 3.14)", choices:["153.86","154.00","149.86"], correctIndex:0 },
  { id:"math-m-004", subject:"Math", difficulty:"medium", text:"What is 2⁸?", choices:["256","128","512"], correctIndex:0 },
  { id:"math-m-005", subject:"Math", difficulty:"medium", text:"What is 25% of 360?", choices:["80","90","100"], correctIndex:1 },
  { id:"math-m-006", subject:"Math", difficulty:"medium", text:"What is the LCM of 4 and 6?", choices:["12","24","8"], correctIndex:0 },
  { id:"math-m-007", subject:"Math", difficulty:"medium", text:"If a triangle has angles 50° and 70°, what is the third angle?", choices:["60°","70°","80°"], correctIndex:0 },
  { id:"math-m-008", subject:"Math", difficulty:"medium", text:"What is the slope of y = 3x − 5?", choices:["-5","3","-3"], correctIndex:1 },
  { id:"math-m-009", subject:"Math", difficulty:"medium", text:"What is 5! (5 factorial)?", choices:["100","120","60"], correctIndex:1 },
  { id:"math-m-010", subject:"Math", difficulty:"medium", text:"What is the GCF of 48 and 36?", choices:["6","12","18"], correctIndex:1 },

  /* ─────────────── MATH – HARD ─────────────── */
  { id:"math-h-001", subject:"Math", difficulty:"hard", text:"What is the derivative of f(x) = x³ − 4x?", choices:["3x² − 4","3x² − 4x","x² − 4"], correctIndex:0 },
  { id:"math-h-002", subject:"Math", difficulty:"hard", text:"What is ∫(2x)dx?", choices:["x²+C","2x²+C","x+C"], correctIndex:0 },
  { id:"math-h-003", subject:"Math", difficulty:"hard", text:"If log₂(x) = 5, what is x?", choices:["10","25","32"], correctIndex:2 },
  { id:"math-h-004", subject:"Math", difficulty:"hard", text:"What is the sum of the infinite geometric series 1 + 1/2 + 1/4 + …?", choices:["2","3","1.5"], correctIndex:0 },
  { id:"math-h-005", subject:"Math", difficulty:"hard", text:"What is the quadratic formula solution for x² − 5x + 6 = 0?", choices:["x=2,3","x=1,6","x=−2,−3"], correctIndex:0 },
  { id:"math-h-006", subject:"Math", difficulty:"hard", text:"What is sin(90°)?", choices:["0","1","0.5"], correctIndex:1 },
  { id:"math-h-007", subject:"Math", difficulty:"hard", text:"How many prime numbers are between 1 and 20?", choices:["7","8","9"], correctIndex:1 },
  { id:"math-h-008", subject:"Math", difficulty:"hard", text:"What is the determinant of [[2,3],[1,4]]?", choices:["11","5","8"], correctIndex:1 },

  /* ─────────────── SCIENCE – EASY ─────────────── */
  { id:"sci-e-001", subject:"Science", difficulty:"easy", text:"What planet is closest to the Sun?", choices:["Venus","Mercury","Mars"], correctIndex:1 },
  { id:"sci-e-002", subject:"Science", difficulty:"easy", text:"What is the chemical symbol for water?", choices:["CO₂","H₂O","NaCl"], correctIndex:1 },
  { id:"sci-e-003", subject:"Science", difficulty:"easy", text:"What gas do plants primarily take in during photosynthesis?", choices:["O₂","N₂","CO₂"], correctIndex:2 },
  { id:"sci-e-004", subject:"Science", difficulty:"easy", text:"What is the boiling point of water at sea level (°C)?", choices:["90°C","110°C","100°C"], correctIndex:2 },
  { id:"sci-e-005", subject:"Science", difficulty:"easy", text:"What force keeps planets in orbit around the Sun?", choices:["Magnetism","Gravity","Friction"], correctIndex:1 },
  { id:"sci-e-006", subject:"Science", difficulty:"easy", text:"What is the speed of light (approx.) in km/s?", choices:["300,000","30,000","3,000,000"], correctIndex:0 },
  { id:"sci-e-007", subject:"Science", difficulty:"easy", text:"What is the smallest unit of matter?", choices:["Molecule","Atom","Cell"], correctIndex:1 },
  { id:"sci-e-008", subject:"Science", difficulty:"easy", text:"What type of energy does the sun produce?", choices:["Nuclear","Chemical","Kinetic"], correctIndex:0 },
  { id:"sci-e-009", subject:"Science", difficulty:"easy", text:"How many bones are in the adult human body?", choices:["196","206","216"], correctIndex:1 },
  { id:"sci-e-010", subject:"Science", difficulty:"easy", text:"What is the chemical symbol for gold?", choices:["Go","Gd","Au"], correctIndex:2 },

  /* ─────────────── SCIENCE – MEDIUM ─────────────── */
  { id:"sci-m-001", subject:"Science", difficulty:"medium", text:"What is Newton's second law of motion?", choices:["F=ma","E=mc²","PV=nRT"], correctIndex:0 },
  { id:"sci-m-002", subject:"Science", difficulty:"medium", text:"What is the atomic number of Carbon?", choices:["6","12","14"], correctIndex:0 },
  { id:"sci-m-003", subject:"Science", difficulty:"medium", text:"In which layer of the atmosphere do weather events occur?", choices:["Stratosphere","Thermosphere","Troposphere"], correctIndex:2 },
  { id:"sci-m-004", subject:"Science", difficulty:"medium", text:"What type of rock is formed from cooled lava?", choices:["Sedimentary","Metamorphic","Igneous"], correctIndex:2 },
  { id:"sci-m-005", subject:"Science", difficulty:"medium", text:"What is the powerhouse of the cell?", choices:["Nucleus","Mitochondria","Ribosome"], correctIndex:1 },
  { id:"sci-m-006", subject:"Science", difficulty:"medium", text:"Which element has the symbol 'Fe'?", choices:["Fluorine","Iron","Fermium"], correctIndex:1 },
  { id:"sci-m-007", subject:"Science", difficulty:"medium", text:"What is the pH of pure water?", choices:["6","7","8"], correctIndex:1 },
  { id:"sci-m-008", subject:"Science", difficulty:"medium", text:"What law says energy cannot be created or destroyed?", choices:["Newton's 3rd Law","Conservation of Energy","Ohm's Law"], correctIndex:1 },
  { id:"sci-m-009", subject:"Science", difficulty:"medium", text:"What is the process by which plants make food?", choices:["Respiration","Photosynthesis","Fermentation"], correctIndex:1 },
  { id:"sci-m-010", subject:"Science", difficulty:"medium", text:"What particle in an atom has no charge?", choices:["Proton","Neutron","Electron"], correctIndex:1 },

  /* ─────────────── SCIENCE – HARD ─────────────── */
  { id:"sci-h-001", subject:"Science", difficulty:"hard", text:"What is the half-life of Carbon-14?", choices:["570 years","5,730 years","57,300 years"], correctIndex:1 },
  { id:"sci-h-002", subject:"Science", difficulty:"hard", text:"What is the formula for Ohm's Law?", choices:["P=IV","V=IR","F=qE"], correctIndex:1 },
  { id:"sci-h-003", subject:"Science", difficulty:"hard", text:"What is Avogadro's number?", choices:["6.02×10²³","6.02×10²²","6.02×10²⁴"], correctIndex:0 },
  { id:"sci-h-004", subject:"Science", difficulty:"hard", text:"What is the Heisenberg Uncertainty Principle related to?", choices:["Wave-particle duality","Position and momentum","Quantum spin"], correctIndex:1 },
  { id:"sci-h-005", subject:"Science", difficulty:"hard", text:"What is the SI unit of electric current?", choices:["Volt","Ampere","Watt"], correctIndex:1 },
  { id:"sci-h-006", subject:"Science", difficulty:"hard", text:"What is the name of the process splitting an atom?", choices:["Fusion","Fission","Decay"], correctIndex:1 },
  { id:"sci-h-007", subject:"Science", difficulty:"hard", text:"What force holds the nucleus of an atom together?", choices:["Electromagnetic","Weak nuclear","Strong nuclear"], correctIndex:2 },

  /* ─────────────── HISTORY – EASY ─────────────── */
  { id:"hist-e-001", subject:"History", difficulty:"easy", text:"In which year did World War II end?", choices:["1943","1945","1947"], correctIndex:1 },
  { id:"hist-e-002", subject:"History", difficulty:"easy", text:"Who was the first President of the United States?", choices:["Abraham Lincoln","Thomas Jefferson","George Washington"], correctIndex:2 },
  { id:"hist-e-003", subject:"History", difficulty:"easy", text:"Which empire was ruled by Julius Caesar?", choices:["Greek","Roman","Persian"], correctIndex:1 },
  { id:"hist-e-004", subject:"History", difficulty:"easy", text:"In what year did Christopher Columbus reach the Americas?", choices:["1392","1492","1592"], correctIndex:1 },
  { id:"hist-e-005", subject:"History", difficulty:"easy", text:"What wall divided East and West Berlin?", choices:["The Iron Curtain","The Berlin Wall","Hadrian's Wall"], correctIndex:1 },
  { id:"hist-e-006", subject:"History", difficulty:"easy", text:"Who was the Egyptian Queen known for alliances with Caesar and Antony?", choices:["Nefertiti","Cleopatra","Hatshepsut"], correctIndex:1 },
  { id:"hist-e-007", subject:"History", difficulty:"easy", text:"What was the name of the ship that sank in 1912?", choices:["Lusitania","Titanic","Britannic"], correctIndex:1 },
  { id:"hist-e-008", subject:"History", difficulty:"easy", text:"Which country invented paper?", choices:["India","Egypt","China"], correctIndex:2 },

  /* ─────────────── HISTORY – MEDIUM ─────────────── */
  { id:"hist-m-001", subject:"History", difficulty:"medium", text:"What year did the French Revolution begin?", choices:["1776","1789","1804"], correctIndex:1 },
  { id:"hist-m-002", subject:"History", difficulty:"medium", text:"Who wrote the Communist Manifesto?", choices:["Lenin & Stalin","Marx & Engels","Trotsky & Mao"], correctIndex:1 },
  { id:"hist-m-003", subject:"History", difficulty:"medium", text:"Which country was NOT part of the Allied Powers in WWII?", choices:["USA","Germany","USSR"], correctIndex:1 },
  { id:"hist-m-004", subject:"History", difficulty:"medium", text:"What ancient wonder stood in Alexandria?", choices:["Colossus of Rhodes","Lighthouse of Alexandria","Hanging Gardens"], correctIndex:1 },
  { id:"hist-m-005", subject:"History", difficulty:"medium", text:"In what year did the Cold War officially end?", choices:["1989","1991","1993"], correctIndex:1 },
  { id:"hist-m-006", subject:"History", difficulty:"medium", text:"Who was the first person to walk on the Moon?", choices:["Buzz Aldrin","Yuri Gagarin","Neil Armstrong"], correctIndex:2 },
  { id:"hist-m-007", subject:"History", difficulty:"medium", text:"What was the name of the first artificial satellite launched into space?", choices:["Explorer 1","Sputnik","Vostok"], correctIndex:1 },
  { id:"hist-m-008", subject:"History", difficulty:"medium", text:"Which war was fought between the North and South of the USA?", choices:["Revolutionary War","Civil War","Spanish-American War"], correctIndex:1 },
  { id:"hist-m-009", subject:"History", difficulty:"medium", text:"Who was the British Prime Minister during most of WWII?", choices:["Neville Chamberlain","Winston Churchill","Clement Attlee"], correctIndex:1 },
  { id:"hist-m-010", subject:"History", difficulty:"medium", text:"What civilisation built the Machu Picchu citadel?", choices:["Aztec","Maya","Inca"], correctIndex:2 },

  /* ─────────────── HISTORY – HARD ─────────────── */
  { id:"hist-h-001", subject:"History", difficulty:"hard", text:"What was the name of the plan for Nazi Germany's genocide of Jews?", choices:["Operation Barbarossa","The Final Solution","Kristallnacht"], correctIndex:1 },
  { id:"hist-h-002", subject:"History", difficulty:"hard", text:"Which treaty ended World War I?", choices:["Treaty of Paris","Treaty of Versailles","Treaty of London"], correctIndex:1 },
  { id:"hist-h-003", subject:"History", difficulty:"hard", text:"Which city was the capital of the Byzantine Empire?", choices:["Athens","Constantinople","Alexandria"], correctIndex:1 },
  { id:"hist-h-004", subject:"History", difficulty:"hard", text:"Who commanded the Mongol Empire at its largest extent?", choices:["Genghis Khan","Kublai Khan","Tamerlane"], correctIndex:0 },
  { id:"hist-h-005", subject:"History", difficulty:"hard", text:"What was the name of the first atomic bomb dropped in combat?", choices:["Fat Man","Little Boy","Trinity"], correctIndex:1 },
  { id:"hist-h-006", subject:"History", difficulty:"hard", text:"In which year did the Russian Revolution overthrow the Tsar?", choices:["1905","1917","1921"], correctIndex:1 },
  { id:"hist-h-007", subject:"History", difficulty:"hard", text:"What empire did Alexander the Great conquer Persia from?", choices:["He was Macedonian","He was Greek","He was Roman"], correctIndex:0 },

  /* ─────────────── LANGUAGE – EASY ─────────────── */
  { id:"lang-e-001", subject:"Language", difficulty:"easy", text:"Which word is a synonym for 'happy'?", choices:["Melancholy","Joyful","Anxious"], correctIndex:1 },
  { id:"lang-e-002", subject:"Language", difficulty:"easy", text:"What is the plural of 'child'?", choices:["Childs","Children","Childrens"], correctIndex:1 },
  { id:"lang-e-003", subject:"Language", difficulty:"easy", text:"Which sentence uses correct punctuation?", choices:["Its cold outside.","It's cold outside.","Its' cold outside."], correctIndex:1 },
  { id:"lang-e-004", subject:"Language", difficulty:"easy", text:"What is an antonym of 'ancient'?", choices:["Old","Modern","Historic"], correctIndex:1 },
  { id:"lang-e-005", subject:"Language", difficulty:"easy", text:"What part of speech is the word 'quickly'?", choices:["Adjective","Noun","Adverb"], correctIndex:2 },
  { id:"lang-e-006", subject:"Language", difficulty:"easy", text:"Which word is a noun?", choices:["Run","Beautiful","Freedom"], correctIndex:2 },
  { id:"lang-e-007", subject:"Language", difficulty:"easy", text:"What is a haiku known for?", choices:["Rhyme scheme","17 syllables in 5-7-5","Four stanzas"], correctIndex:1 },
  { id:"lang-e-008", subject:"Language", difficulty:"easy", text:"'She sells seashells by the seashore' is an example of?", choices:["Alliteration","Metaphor","Hyperbole"], correctIndex:0 },

  /* ─────────────── LANGUAGE – MEDIUM ─────────────── */
  { id:"lang-m-001", subject:"Language", difficulty:"medium", text:"What literary device compares two unlike things without using 'like' or 'as'?", choices:["Simile","Metaphor","Personification"], correctIndex:1 },
  { id:"lang-m-002", subject:"Language", difficulty:"medium", text:"What is the subject in: 'The quick fox jumped over the fence.'?", choices:["Jumped","Fox","Fence"], correctIndex:1 },
  { id:"lang-m-003", subject:"Language", difficulty:"medium", text:"Which verb tense is used in: 'I had finished my homework.'?", choices:["Past simple","Past perfect","Present perfect"], correctIndex:1 },
  { id:"lang-m-004", subject:"Language", difficulty:"medium", text:"What does the prefix 'mis-' mean?", choices:["Wrong/bad","Before","Over"], correctIndex:0 },
  { id:"lang-m-005", subject:"Language", difficulty:"medium", text:"Which word is spelled correctly?", choices:["Recieve","Receive","Receeve"], correctIndex:1 },
  { id:"lang-m-006", subject:"Language", difficulty:"medium", text:"A word that sounds like another but has a different meaning is called a?", choices:["Synonym","Homophone","Antonym"], correctIndex:1 },
  { id:"lang-m-007", subject:"Language", difficulty:"medium", text:"What is the correct form? 'Neither the students nor the teacher ___ ready.'", choices:["are","were","is"], correctIndex:2 },
  { id:"lang-m-008", subject:"Language", difficulty:"medium", text:"'The world is a stage' is an example of?", choices:["Extended metaphor","Simile","Allusion"], correctIndex:0 },
  { id:"lang-m-009", subject:"Language", difficulty:"medium", text:"What is the passive voice of 'The chef cooked the meal'?", choices:["The meal was cooked by the chef","The chef had cooked the meal","The meal got cooked"], correctIndex:0 },
  { id:"lang-m-010", subject:"Language", difficulty:"medium", text:"Which is the correct spelling?", choices:["Occurance","Occurrence","Occurrance"], correctIndex:1 },

  /* ─────────────── LANGUAGE – HARD ─────────────── */
  { id:"lang-h-001", subject:"Language", difficulty:"hard", text:"What is a 'synecdoche'?", choices:["Using a part to represent the whole","Excessive exaggeration","Contradictory terms together"], correctIndex:0 },
  { id:"lang-h-002", subject:"Language", difficulty:"hard", text:"In which work does Shakespeare write 'To be, or not to be'?", choices:["Macbeth","Hamlet","Othello"], correctIndex:1 },
  { id:"lang-h-003", subject:"Language", difficulty:"hard", text:"What is the rhetorical term for repeating a word at the end of successive clauses?", choices:["Anaphora","Epistrophe","Chiasmus"], correctIndex:1 },
  { id:"lang-h-004", subject:"Language", difficulty:"hard", text:"What grammatical mood is used for hypothetical or wishful statements?", choices:["Indicative","Imperative","Subjunctive"], correctIndex:2 },
  { id:"lang-h-005", subject:"Language", difficulty:"hard", text:"What is the term for an author's unique style and voice?", choices:["Register","Diction","Idiolect"], correctIndex:2 },
  { id:"lang-h-006", subject:"Language", difficulty:"hard", text:"What literary device involves the repetition of a word at the start of successive clauses?", choices:["Epistrophe","Anaphora","Parallelism"], correctIndex:1 },

  /* ─────────────── BIOLOGY – EASY ─────────────── */
  { id:"bio-e-001", subject:"Biology", difficulty:"easy", text:"What is the basic unit of life?", choices:["Tissue","Organ","Cell"], correctIndex:2 },
  { id:"bio-e-002", subject:"Biology", difficulty:"easy", text:"What carries oxygen in red blood cells?", choices:["Plasma","Hemoglobin","Platelets"], correctIndex:1 },
  { id:"bio-e-003", subject:"Biology", difficulty:"easy", text:"What process do plants use to make food using sunlight?", choices:["Respiration","Photosynthesis","Digestion"], correctIndex:1 },
  { id:"bio-e-004", subject:"Biology", difficulty:"easy", text:"What is the human body's largest organ?", choices:["Liver","Lungs","Skin"], correctIndex:2 },
  { id:"bio-e-005", subject:"Biology", difficulty:"easy", text:"How many chromosomes does a typical human cell have?", choices:["23","46","92"], correctIndex:1 },
  { id:"bio-e-006", subject:"Biology", difficulty:"easy", text:"What is the name of the structure in the cell that contains DNA?", choices:["Nucleus","Mitochondria","Vacuole"], correctIndex:0 },
  { id:"bio-e-007", subject:"Biology", difficulty:"easy", text:"What type of blood vessel carries blood away from the heart?", choices:["Vein","Artery","Capillary"], correctIndex:1 },
  { id:"bio-e-008", subject:"Biology", difficulty:"easy", text:"What kingdom do mushrooms belong to?", choices:["Plantae","Animalia","Fungi"], correctIndex:2 },

  /* ─────────────── BIOLOGY – MEDIUM ─────────────── */
  { id:"bio-m-001", subject:"Biology", difficulty:"medium", text:"What is the process by which cells divide to produce identical copies?", choices:["Meiosis","Mitosis","Mutation"], correctIndex:1 },
  { id:"bio-m-002", subject:"Biology", difficulty:"medium", text:"Which organ produces insulin?", choices:["Liver","Kidneys","Pancreas"], correctIndex:2 },
  { id:"bio-m-003", subject:"Biology", difficulty:"medium", text:"What is the term for an organism that makes its own food?", choices:["Decomposer","Heterotroph","Autotroph"], correctIndex:2 },
  { id:"bio-m-004", subject:"Biology", difficulty:"medium", text:"What is the role of ribosomes in a cell?", choices:["Energy production","Protein synthesis","DNA replication"], correctIndex:1 },
  { id:"bio-m-005", subject:"Biology", difficulty:"medium", text:"What is the name of the process where plants release water vapor?", choices:["Transpiration","Respiration","Condensation"], correctIndex:0 },
  { id:"bio-m-006", subject:"Biology", difficulty:"medium", text:"Which molecule carries genetic information?", choices:["RNA","Protein","DNA"], correctIndex:2 },
  { id:"bio-m-007", subject:"Biology", difficulty:"medium", text:"What is the term for the physical expression of a gene?", choices:["Genotype","Allele","Phenotype"], correctIndex:2 },
  { id:"bio-m-008", subject:"Biology", difficulty:"medium", text:"Which part of the brain controls balance and coordination?", choices:["Cerebrum","Cerebellum","Medulla"], correctIndex:1 },

  /* ─────────────── BIOLOGY – HARD ─────────────── */
  { id:"bio-h-001", subject:"Biology", difficulty:"hard", text:"What is the term for the process where RNA is made from DNA?", choices:["Translation","Transcription","Replication"], correctIndex:1 },
  { id:"bio-h-002", subject:"Biology", difficulty:"hard", text:"What type of bond holds the two strands of DNA together?", choices:["Covalent bond","Ionic bond","Hydrogen bond"], correctIndex:2 },
  { id:"bio-h-003", subject:"Biology", difficulty:"hard", text:"What is the Krebs cycle also known as?", choices:["Citric acid cycle","Calvin cycle","Electron transport chain"], correctIndex:0 },
  { id:"bio-h-004", subject:"Biology", difficulty:"hard", text:"Which enzyme unwinds the DNA double helix during replication?", choices:["DNA polymerase","Helicase","Ligase"], correctIndex:1 },
  { id:"bio-h-005", subject:"Biology", difficulty:"hard", text:"What is the term for a change in DNA sequence?", choices:["Meiosis","Mutation","Mitosis"], correctIndex:1 },
  { id:"bio-h-006", subject:"Biology", difficulty:"hard", text:"Which organelle is responsible for the cell's energy production via ATP?", choices:["Nucleus","Golgi apparatus","Mitochondria"], correctIndex:2 },

  /* ─────────────── GENERAL / OTHER – EASY ─────────────── */
  { id:"other-e-001", subject:"Other", difficulty:"easy", text:"How many continents are there on Earth?", choices:["5","6","7"], correctIndex:2 },
  { id:"other-e-002", subject:"Other", difficulty:"easy", text:"Which country is the largest by land area?", choices:["Canada","China","Russia"], correctIndex:2 },
  { id:"other-e-003", subject:"Other", difficulty:"easy", text:"What is the capital of France?", choices:["Lyon","Marseille","Paris"], correctIndex:2 },
  { id:"other-e-004", subject:"Other", difficulty:"easy", text:"How many colors are in a rainbow?", choices:["5","7","9"], correctIndex:1 },
  { id:"other-e-005", subject:"Other", difficulty:"easy", text:"What is the tallest mountain on Earth?", choices:["K2","Everest","Kangchenjunga"], correctIndex:1 },
  { id:"other-e-006", subject:"Other", difficulty:"easy", text:"Which ocean is the largest?", choices:["Atlantic","Indian","Pacific"], correctIndex:2 },
  { id:"other-e-007", subject:"Other", difficulty:"easy", text:"What is H₂O commonly known as?", choices:["Oxygen","Water","Salt"], correctIndex:1 },
  { id:"other-e-008", subject:"Other", difficulty:"easy", text:"In what year did the first iPhone launch?", choices:["2005","2007","2009"], correctIndex:1 },

  /* ─────────────── GENERAL / OTHER – MEDIUM ─────────────── */
  { id:"other-m-001", subject:"Other", difficulty:"medium", text:"What is the smallest country in the world?", choices:["Monaco","San Marino","Vatican City"], correctIndex:2 },
  { id:"other-m-002", subject:"Other", difficulty:"medium", text:"Which programming language is known for its use in web front-end development?", choices:["Python","JavaScript","Swift"], correctIndex:1 },
  { id:"other-m-003", subject:"Other", difficulty:"medium", text:"What does 'URL' stand for?", choices:["Universal Resource Locator","Uniform Resource Locator","United Resource Link"], correctIndex:1 },
  { id:"other-m-004", subject:"Other", difficulty:"medium", text:"Which artist painted the Sistine Chapel ceiling?", choices:["Da Vinci","Raphael","Michelangelo"], correctIndex:2 },
  { id:"other-m-005", subject:"Other", difficulty:"medium", text:"What is the longest river in the world?", choices:["Amazon","Nile","Yangtze"], correctIndex:1 },
  { id:"other-m-006", subject:"Other", difficulty:"medium", text:"In which year was the World Wide Web invented?", choices:["1983","1989","1995"], correctIndex:1 },
  { id:"other-m-007", subject:"Other", difficulty:"medium", text:"What does 'RAM' stand for in computing?", choices:["Rapid Access Memory","Random Access Memory","Read And Modify"], correctIndex:1 },
  { id:"other-m-008", subject:"Other", difficulty:"medium", text:"What is the capital of Japan?", choices:["Osaka","Kyoto","Tokyo"], correctIndex:2 },

  /* ─────────────── GENERAL / OTHER – HARD ─────────────── */
  { id:"other-h-001", subject:"Other", difficulty:"hard", text:"What is the Turing Test designed to evaluate?", choices:["Computer speed","Machine intelligence","Data security"], correctIndex:1 },
  { id:"other-h-002", subject:"Other", difficulty:"hard", text:"What is the name of the logical paradox: 'This statement is false'?", choices:["Russell's Paradox","The Liar Paradox","Zeno's Paradox"], correctIndex:1 },
  { id:"other-h-003", subject:"Other", difficulty:"hard", text:"In economics, what does 'GDP' stand for?", choices:["Gross Domestic Product","General Development Plan","Gross Demand Percentage"], correctIndex:0 },
  { id:"other-h-004", subject:"Other", difficulty:"hard", text:"What is the term for the study of flags?", choices:["Heraldry","Vexillology","Numismatics"], correctIndex:1 },
  { id:"other-h-005", subject:"Other", difficulty:"hard", text:"What is the name of the philosophical thought experiment of the 'Ship of Theseus'?", choices:["Identity paradox","Metaphysical problem of continuity","Plato's allegory"], correctIndex:1 },
  { id:"other-h-006", subject:"Other", difficulty:"hard", text:"In which year was the United Nations founded?", choices:["1944","1945","1946"], correctIndex:1 }

];
