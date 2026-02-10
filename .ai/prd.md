# Dokument wymagań produktu (PRD) - SmartShopping

## 1. Przegląd produktu

SmartShopping to webowa aplikacja typu PWA (Progressive Web App) ułatwiająca tworzenie i wspólne zarządzanie listami zakupów. Produkt skupia się na szybkim dodawaniu produktów, automatycznym przypisywaniu ich do predefiniowanych kategorii przy użyciu AI oraz wygodnym korzystaniu ze smartfona w sklepie (w tym w trybie offline).

Kluczowe cechy:

- Tworzenie, edycja i usuwanie list zakupowych przechowywanych na koncie użytkownika.
- Dodawanie, edycja, oznaczanie jako kupione oraz usuwanie produktów w czasie rzeczywistym.
- Automatyczne przypisywanie produktów do kategorii przez model AI z możliwością ręcznej zmiany.
- Współdzielenie list i współpraca wielu osób w czasie rzeczywistym (synchronizacja via WebSocket).
- Prosty system kont z poziomami Basic i Premium (Premium jako fake door – brak realnych płatności).
- Interfejs zaprojektowany pod szybkie użycie w sklepie, z czytelnym grupowaniem produktów wg kategorii.

Produkt w wersji MVP jest dostępny wyłącznie jako aplikacja webowa (desktop + mobile web), z wsparciem PWA i trybu offline. Brak natywnych aplikacji mobilnych w zakresie MVP.

## 2. Problem użytkownika

Użytkownicy tworzą listy zakupów w pośpiechu, często na papierowych karteczkach lub w prostych notatkach w telefonie. Powoduje to kilka problemów:

- Lista jest niestrukturyzowana, produkty nie są pogrupowane według działów sklepu, przez co użytkownik musi wracać się po te same alejki.
- Trudno jest aktualizować listę w czasie rzeczywistym, gdy kilka osób planuje zakupy razem (np. para, współlokatorzy, rodzina).
- Brakuje prostego, szybkiego mechanizmu dodawania produktów bez konieczności ręcznego przypisywania kategorii.
- Różne listy (np. tygodniowa, na imprezę, na wyjazd) są rozproszone i trudno nimi zarządzać.

SmartShopping rozwiązuje te problemy poprzez:

- Automatyczną kategoryzację produktów przy użyciu AI na podstawie nazwy produktu.
- Grupowanie produktów na liście według kategorii, co odzwierciedla typowy układ sklepu.
- Współdzielenie list z innymi osobami i natychmiastową synchronizację zmian.
- Przechowywanie list w chmurze, powiązanych z kontem użytkownika, z możliwością korzystania offline.

## 3. Wymagania funkcjonalne

3.1. Konta użytkowników i uwierzytelnianie

- Re-001: System musi umożliwiać rejestrację użytkownika przy użyciu adresu e-mail i hasła.
- Re-002: System musi umożliwiać logowanie użytkownika za pomocą e-maila i hasła.
- Re-003: System musi umożliwiać wylogowanie użytkownika z aplikacji.
- Re-004: System musi umożliwiać zmianę hasła po zalogowaniu.
- Re-005: System musi umożliwiać usunięcie konta użytkownika wraz z powiązanymi danymi (listy jako właściciel, powiązania jako współdzielony uczestnik) zgodnie z przyjętą polityką.
- Re-006: Dostęp do list i produktów musi być ograniczony do zalogowanych użytkowników, którzy są właścicielem lub współuczestnikiem danej listy.
- Re-007: System musi utrzymywać sesję użytkownika (np. za pomocą tokena/ciasteczek) tak, aby użytkownik nie musiał logować się przy każdym otwarciu aplikacji, z mechanizmem automatycznego wylogowania po określonym czasie nieaktywności.

  3.2. Zarządzanie kontem i planem (Basic / Premium)

- Re-008: System musi przechowywać w profilu użytkownika flagę planu (Basic lub Premium).
- Re-009: Użytkownik w planie Basic może być właścicielem maksymalnie 1 listy zakupów.
- Re-010: Użytkownik w planie Basic może dodać maksymalnie 10 produktów na każdej liście, której jest właścicielem.
- Re-011: Użytkownik w planie Premium może tworzyć nielimitowaną liczbę list.
- Re-012: Użytkownik w planie Premium może dodać maksymalnie 50 produktów na każdej liście, której jest właścicielem.
- Re-013: Limity liczby list i produktów dotyczą tylko list, których użytkownik jest właścicielem; listy, do których dołączył jako współuczestnik, nie liczą się do limitu liczby list właściciela.
- Re-014: System musi uwzględniać limity na podstawie planu właściciela listy (gość Basic może edytować listę Premium, która ma wyższe limity).
- Re-015: Funkcja przejścia na plan Premium jest zrealizowana jako fake door (np. przycisk otwierający modal informacyjny); nie istnieje realna integracja płatności.

  3.3. Zarządzanie listami zakupów

- Re-016: System musi umożliwiać tworzenie nowej listy zakupów (nazwa + kolor z ograniczonej palety pastelowych kolorów).
- Re-017: System musi umożliwiać edycję nazwy listy i jej koloru.
- Re-018: System musi umożliwiać trwałe usunięcie listy przez właściciela.
- Re-019: Na ekranie głównym użytkownik musi widzieć dashboard z kafelkami wszystkich swoich list (jako właściciel oraz współdzielone).
- Re-020: Dashboard musi obsługiwać stan pusty (brak list) z jasnym komunikatem i przyciskami akcji (Nowa lista, Dołącz kodem).
- Re-021: Każda lista musi być powiązana z właścicielem oraz przechowywać informacje o zaproszonych uczestnikach.

  3.4. Zarządzanie produktami na liście

- Re-022: System musi umożliwiać dodanie produktu do listy poprzez pole tekstowe.
- Re-023: Nazwa produktu musi być trimowana (usunięcie wiodących i końcowych spacji) oraz podlegać limitowi długości 50 znaków.
- Re-024: System musi blokować dodanie drugiego produktu o identycznej nazwie (case-insensitive) w ramach tej samej listy i wyświetlać czytelny komunikat o duplikacie.
- Re-025: System musi umożliwiać edycję nazwy produktu i (opcjonalnie) przypisanej kategorii przez użytkownika.
- Re-026: System musi umożliwiać oznaczanie produktu jako kupionego oraz cofnięcie tego oznaczenia.
- Re-027: System musi umożliwiać usunięcie pojedynczego produktu z listy.
- Re-028: System musi umożliwiać usunięcie wszystkich kupionych produktów jednym przyciskiem, z dodatkowym modalem potwierdzenia.
- Re-029: Produkty muszą być na liście grupowane według kategorii.
- Re-030: W obrębie danej kategorii kolejność produktów powinna odpowiadać kolejności dodania, z wyjątkiem zachowania przy zmianie statusu kupiony/niekupiony (zgodnie z logiką niżej).
- Re-031: Oznaczenie produktu jako kupiony przenosi go na dół całej listy (lub sekcji kupionych) i wizualnie odróżnia (np. przekreślenie, mniejsza przezroczystość).
- Re-032: Cofnięcie oznaczenia kupiony przenosi produkt na koniec listy w ramach jego kategorii i przywraca normalne formatowanie.

  3.5. Kategoryzacja produktów (AI)

- Re-033: Przy każdym dodaniu nowego produktu system musi spróbować automatycznie przypisać kategorię na podstawie nazwy produktu.
- Re-034: Lista kategorii jest zamknięta i predefiniowana (np. Warzywa, Owoce, Nabiał, Pieczywo, Napoje, Chemia, Inne).
- Re-035: System musi wykorzystywać globalny cache (słownik) przypisań produkt -> kategoria (case-insensitive), aby ograniczać liczbę zapytań do modelu AI.
- Re-036: W pierwszej kolejności system sprawdza cache; gdy brak wpisu, wysyła zapytanie do modelu AI o kategorię.
- Re-037: Gdy model AI zwróci kategorię spoza listy predefiniowanej, system mapuje ją do najbliższej pasującej kategorii lub przypisuje kategorię Inne.
- Re-038: W przypadku błędu wywołania AI system przypisuje produkt do kategorii Inne i informuje użytkownika w niewintruzyny sposób (np. toast).
- Re-039: Użytkownik może ręcznie zmienić kategorię produktu; po zmianie system może zaktualizować cache, aby poprawić przyszłe przypisania.

  3.6. Współdzielenie list i kolaboracja

- Re-040: Właściciel listy musi mieć możliwość wygenerowania kodu zaproszenia (6 znaków, np. alfanumeryczny), ważnego przez 24 godziny.
- Re-041: Alternatywnie system może generować link zawierający kod zaproszenia.
- Re-042: Użytkownik, który posiada kod lub link, może dołączyć do listy, jeżeli jest zalogowany.
- Re-043: System musi wymagać zalogowania przed dołączeniem do listy poprzez kod lub link.
- Re-044: Po dołączeniu do listy użytkownik staje się współuczestnikiem z rolą Editor.
- Re-045: Właściciel listy ma rolę Owner i może zarządzać uczestnikami (np. usuwanie z listy, ponowne generowanie kodu).
- Re-046: Uprawnienia:
  - Owner: pełna edycja listy i produktów, zarządzanie zaproszeniami i uczestnikami, usunięcie listy.
  - Editor: dodawanie, edytowanie, oznaczanie i usuwanie produktów, brak możliwości usunięcia listy oraz zarządzania zaproszeniami i uczestnikami.
- Re-047: Zmiany w listach i produktach dokonane przez Ownera lub Editorów muszą być synchronizowane w czasie rzeczywistym między wszystkimi uczestnikami (WebSocket).
- Re-048: System musi rozwiązywać konflikty zmian strategią Last Write Wins.
- Re-049: Aplikacja musi wizualnie komunikować stan synchronizacji/ładowania (np. skeletony, wskaźnik ładowania przy przejściach).

  3.7. Interfejs użytkownika i doświadczenie (UX)

- Re-050: Interfejs musi być zoptymalizowany pod pracę na urządzeniach mobilnych (duże strefy dotyku, czytelne fonty, kontrast, accessibility).
- Re-051: Kategoryzacja musi być wyraźnie widoczna (nagłówki kategorii na liście).
- Re-052: Aplikacja musi oferować spójny, minimalistyczny design z ograniczoną paletą pastelowych kolorów dla list.
- Re-053: Dashboard i ekrany list muszą mieć czytelne główne akcje (Nowa lista, Dołącz kodem, Dodaj produkt).
- Re-054: Aplikacja musi prezentować stany pustych widoków (np. brak produktów na liście) z krótką instrukcją dalszych działań.
- Re-055: System musi zapewniać jasny feedback na działania użytkownika (np. toasty przy błędach, duplikatach, sukcesach).

  3.8. PWA i tryb offline

- Re-056: Aplikacja musi działać jako PWA z możliwością instalacji na urządzeniu użytkownika.
- Re-057: Aplikacja musi umożliwiać przynajmniej przeglądanie ostatniej wersji listy oraz podstawowe operacje (dodawanie, oznaczanie, usuwanie) w trybie offline, z późniejszą synchronizacją po odzyskaniu połączenia.
- Re-058: W przypadku konfliktów edycji offline/online system wykorzystuje strategię Last Write Wins.

  3.9. Bezpieczeństwo i prywatność

- Re-059: Dane użytkownika (e-mail, hasło) muszą być przechowywane w sposób bezpieczny (hasła w postaci haszy z solą).
- Re-060: Dostęp do danych list ograniczony jest do zalogowanych użytkowników z odpowiednimi uprawnieniami (Owner, Editor).

## 4. Granice produktu

Zakres MVP:

- Webowa aplikacja PWA z obsługą offline.
- Jedynie logowanie e-mail/hasło (brak logowania społecznościowego).
- Brak natywnych aplikacji mobilnych.
- Predefiniowana lista kategorii produktów, bez możliwości dodawania własnych kategorii przez użytkownika.
- Jedynie dwa poziomy planów (Basic, Premium) z logicznymi limitami w systemie, bez prawdziwej obsługi płatności.
- Brak zaawansowanej historii zmian (audit logu).
- Brak powiadomień push (web push) w MVP.
- Brak zaawansowanej analityki wewnątrz aplikacji (metryki zbierane głównie po stronie backendu/analityki zewnętrznej).

Poza zakresem MVP:

- Natywne aplikacje mobilne (iOS, Android).
- Integracje z innymi narzędziami (np. kalendarze, listy zewnętrzne).
- Personalizowane układy sklepu (np. mapy konkretnych supermarketów).
- System rekomendacji produktów.
- Automatyczne generowanie list na podstawie historii zakupów.
- System powiadomień push (np. przypomnienie o zakupach) – może zostać rozważony w kolejnych etapach.
- Zaawansowane role (np. tylko do odczytu).
- Rozbudowany system płatności i zarządzania subskrypcjami.

## 5. Historyjki użytkowników

US-001  
Tytuł: Rejestracja nowego użytkownika  
Opis: Jako nowy użytkownik chcę założyć konto przy użyciu adresu e-mail i hasła, aby moje listy zakupów były przechowywane i dostępne na różnych urządzeniach.  
Kryteria akceptacji:

- Użytkownik może wprowadzić e-mail i hasło w formularzu rejestracji.
- System waliduje poprawność adresu e-mail i minimalne wymagania hasła.
- Po poprawnej rejestracji użytkownik jest informowany o sukcesie i może się zalogować.
- Próba rejestracji z e-mailem już istniejącym zwraca czytelny komunikat o błędzie.

US-002  
Tytuł: Logowanie użytkownika  
Opis: Jako zarejestrowany użytkownik chcę zalogować się przy użyciu e-maila i hasła, aby uzyskać dostęp do moich list zakupów.  
Kryteria akceptacji:

- Użytkownik może podać e-mail i hasło w formularzu logowania.
- Przy poprawnych danych użytkownik zostaje zalogowany i przeniesiony na dashboard.
- Przy błędnych danych wyświetlany jest jasny komunikat o niepoprawnych danych.
- Po zalogowaniu użytkownik pozostaje zalogowany przez określony czas, o ile sam się nie wyloguje.

US-003  
Tytuł: Bezpieczny dostęp do list (autoryzacja)  
Opis: Jako zalogowany użytkownik chcę, aby moje listy były widoczne i edytowalne tylko dla mnie i zaproszonych uczestników, aby moje dane były prywatne.  
Kryteria akceptacji:

- Niezalogowany użytkownik nie ma dostępu do widoku list (próba wejścia przekierowuje do logowania).
- Użytkownik widzi tylko te listy, które posiada jako właściciel lub do których został zaproszony.
- Edycja listy i produktów jest możliwa tylko dla użytkowników z rolą Owner lub Editor przypisaną do danej listy.

US-004  
Tytuł: Zmiana hasła  
Opis: Jako zalogowany użytkownik chcę zmienić swoje hasło, aby poprawić bezpieczeństwo konta.  
Kryteria akceptacji:

- Użytkownik ma dostęp do opcji zmiany hasła z menu konta.
- System wymaga podania aktualnego hasła oraz nowego hasła (dwukrotnie).
- Po poprawnej zmianie hasła użytkownik otrzymuje komunikat o sukcesie.
- Przy błędnym aktualnym haśle system odrzuca zmianę i informuje o błędzie.

US-005  
Tytuł: Usunięcie konta  
Opis: Jako zalogowany użytkownik chcę móc usunąć swoje konto, aby moje dane zostały usunięte z systemu.  
Kryteria akceptacji:

- Użytkownik ma dostęp do akcji Usuń konto w menu konta.
- System wyświetla modal potwierdzenia ostrzegający o skutkach usunięcia.
- Po potwierdzeniu konto użytkownika i powiązane dane (listy, dołączenia) są usuwane lub anonimizowane zgodnie z przyjętą polityką.
- Po usunięciu konta użytkownik zostaje wylogowany i nie może zalogować się ponownie na ten sam e-mail (o ile nie założy nowego konta).

US-006  
Tytuł: Przegląd list na dashboardzie  
Opis: Jako zalogowany użytkownik chcę zobaczyć wszystkie swoje listy (własne i współdzielone) w formie czytelnych kafelków, aby szybko wybrać listę do edycji.  
Kryteria akceptacji:

- Dashboard wyświetla kafelki dla wszystkich list, których użytkownik jest właścicielem lub uczestnikiem.
- Każdy kafelek zawiera nazwę listy, kolor oraz ewentualnie prostą informację o liczbie produktów.
- Kliknięcie na kafelek przenosi użytkownika do widoku szczegółów listy.
- W przypadku braku list dashboard prezentuje czytelny stan pusty z przyciskami Nowa lista i Dołącz kodem.

US-007  
Tytuł: Tworzenie nowej listy  
Opis: Jako użytkownik chcę utworzyć nową listę zakupów, aby zorganizować nadchodzące zakupy.  
Kryteria akceptacji:

- Użytkownik może otworzyć formularz tworzenia listy z dashboardu.
- Formularz pozwala wprowadzić nazwę listy i wybrać kolor z ograniczonej palety pastelowych kolorów.
- System sprawdza limit liczby list dla właściciela (w zależności od planu).
- Po poprawnym utworzeniu lista pojawia się na dashboardzie i można ją otworzyć.
- Przy próbie przekroczenia limitu użytkownik otrzymuje czytelny komunikat.

US-008  
Tytuł: Edycja listy  
Opis: Jako właściciel listy chcę zmienić jej nazwę i kolor, aby dostosować ją do aktualnych potrzeb.  
Kryteria akceptacji:

- Właściciel może otworzyć ekran lub modal edycji listy.
- Możliwa jest zmiana nazwy i koloru listy.
- Zapisane zmiany są widoczne na dashboardzie i w widoku listy dla wszystkich uczestników.

US-009  
Tytuł: Usunięcie listy  
Opis: Jako właściciel listy chcę ją usunąć, jeśli nie jest mi już potrzebna, aby utrzymać porządek.  
Kryteria akceptacji:

- Tylko właściciel widzi opcję usunięcia listy.
- System wyświetla modal potwierdzenia przed usunięciem.
- Po potwierdzeniu lista jest usuwana i znika z dashboardu wszystkich uczestników.
- Próba wejścia na usuniętą listę kończy się komunikatem o braku listy.

US-010  
Tytuł: Dodawanie produktu do listy z automatyczną kategoryzacją  
Opis: Jako użytkownik listy chcę szybko dodać produkt, który zostanie automatycznie przypisany do odpowiedniej kategorii, aby nie tracić czasu na ręczne porządkowanie listy.  
Kryteria akceptacji:

- Na widoku listy dostępne jest pole dodawania produktu.
- Użytkownik może wprowadzić nazwę produktu do 50 znaków.
- Po zatwierdzeniu system usuwa nadmiarowe spacje i sprawdza, czy produkt nie jest duplikatem na liście.
- System sprawdza cache przypisań; jeśli brak wpisu, wywołuje AI, aby wybrać kategorię z listy predefiniowanej.
- W razie błędu AI lub niejednoznaczności produkt trafia do kategorii Inne.
- Nowy produkt pojawia się w odpowiedniej kategorii na liście.

US-011  
Tytuł: Blokada duplikatów produktów  
Opis: Jako użytkownik nie chcę przypadkowo dodać drugi raz tego samego produktu do listy, aby uniknąć powtórzeń.  
Kryteria akceptacji:

- Dodanie produktu o nazwie identycznej (case-insensitive) do już istniejącego na liście jest blokowane.
- Użytkownik otrzymuje czytelny komunikat, że produkt już istnieje.
- Żaden nowy wpis produktu nie jest w takim przypadku tworzony.

US-012  
Tytuł: Ręczna zmiana kategorii produktu  
Opis: Jako użytkownik chcę móc ręcznie zmienić kategorię produktu, jeśli automatyczna kategoryzacja nie była trafna.  
Kryteria akceptacji:

- Użytkownik może otworzyć edycję produktu i wybrać inną kategorię z listy predefiniowanej.
- Po zapisaniu produkt pojawia się pod nową kategorią w widoku listy.
- Zmiana jest widoczna dla wszystkich uczestników listy.

US-013  
Tytuł: Edycja nazwy produktu  
Opis: Jako użytkownik chcę zmienić nazwę produktu na liście, jeśli popełniłem błąd przy wpisywaniu.  
Kryteria akceptacji:

- Użytkownik może wejść w tryb edycji produktu i zmienić jego nazwę.
- System nadal stosuje limit 50 znaków i trimowanie spacji.
- Zmiana nazwy nie może prowadzić do utworzenia duplikatu; w takim przypadku system zwraca komunikat o błędzie.

US-014  
Tytuł: Oznaczanie produktu jako kupionego  
Opis: Jako użytkownik w sklepie chcę oznaczać produkty jako kupione, aby widzieć, co już mam w koszyku.  
Kryteria akceptacji:

- Każdy produkt ma łatwo dostępną kontrolkę (np. checkbox), aby oznaczyć go jako kupiony.
- Po oznaczeniu produkt jest wizualnie odróżniony (przekreślenie, mniejszy kontrast).
- Produkt przenosi się na dół listy (lub sekcji kupionych) zgodnie z przyjętą logiką.
- Zmiana jest widoczna dla wszystkich uczestników listy w czasie rzeczywistym.

US-015  
Tytuł: Cofnięcie oznaczenia kupionego produktu  
Opis: Jako użytkownik chcę móc cofnąć oznaczenie kupiony, jeśli zaznaczyłem produkt przypadkowo.  
Kryteria akceptacji:

- Użytkownik może ponownie kliknąć kontrolkę produktu, aby usunąć status kupiony.
- Produkt wraca do normalnego wyglądu na liście.
- Produkt trafia na koniec listy w ramach swojej kategorii.

US-016  
Tytuł: Usuwanie pojedynczego produktu  
Opis: Jako użytkownik chcę usunąć niepotrzebny produkt z listy, aby lista była aktualna.  
Kryteria akceptacji:

- Każdy produkt posiada akcję usuń.
- Po potwierdzeniu (lub bez, w zależności od UX) produkt znika z listy.
- Zmiana jest widoczna natychmiast we wszystkich widokach listy.

US-017  
Tytuł: Czyszczenie wszystkich kupionych produktów  
Opis: Jako użytkownik po zakończonych zakupach chcę szybko usunąć wszystkie kupione produkty, aby przygotować listę na kolejne zakupy.  
Kryteria akceptacji:

- Na poziomie listy dostępny jest przycisk Wyczyść kupione.
- Po jego naciśnięciu system wyświetla modal potwierdzenia.
- Po potwierdzeniu wszystkie produkty oznaczone jako kupione są usuwane z listy.

US-018  
Tytuł: Grupowanie produktów w kategorie  
Opis: Jako użytkownik chcę widzieć produkty na liście pogrupowane według kategorii, aby sprawniej poruszać się po sklepie.  
Kryteria akceptacji:

- Widok listy wyświetla wyraźne nagłówki kategorii.
- Produkty w ramach kategorii są uporządkowane zgodnie z kolejnością dodania, z uwzględnieniem logiki kupiony/niekupiony.
- Dodanie nowego produktu powoduje jego pojawienie się pod odpowiednią kategorią.

US-019  
Tytuł: Współdzielenie listy przez kod  
Opis: Jako właściciel listy chcę wygenerować kod zaproszenia, aby inni użytkownicy mogli dołączyć do mojej listy.  
Kryteria akceptacji:

- Właściciel listy widzi opcję wygeneruj kod zaproszenia.
- Kod ma 6 znaków i jest ważny przez 24 godziny.
- Właściciel może skopiować kod lub wysłać link z wbudowanym kodem.

US-020  
Tytuł: Dołączanie do listy przy użyciu kodu  
Opis: Jako zalogowany użytkownik chcę dołączyć do listy zakupów partnera, wpisując kod zaproszenia, abyśmy mogli wspólnie zarządzać zakupami.  
Kryteria akceptacji:

- Na dashboardzie dostępna jest akcja Dołącz kodem.
- Użytkownik ma możliwość wpisania kodu zaproszenia.
- System weryfikuje poprawność i ważność kodu.
- Po poprawnym kodzie użytkownik jest dodawany jako Editor do listy właściciela.
- W przypadku niepoprawnego lub przeterminowanego kodu system zwraca jasny komunikat o błędzie.

US-021  
Tytuł: Role Owner i Editor  
Opis: Jako użytkownik chcę, aby uprawnienia na liście były jasno rozdzielone, aby uniknąć przypadkowego usunięcia listy przez osobę zaproszoną.  
Kryteria akceptacji:

- Właściciel listy ma uprawnienia do usuwania listy, zarządzania zaproszeniami i uczestnikami oraz pełnej edycji produktów.
- Editor ma uprawnienia do dodawania, edycji, oznaczania i usuwania produktów, ale nie może usunąć listy ani zarządzać zaproszeniami.
- Interfejs jasno komunikuje rolę użytkownika na liście (np. w nagłówku lub menu listy).

US-022  
Tytuł: Synchronizacja zmian w czasie rzeczywistym  
Opis: Jako użytkownik współdzielący listę chcę widzieć niemal natychmiastowe zmiany wprowadzane przez innych, abyśmy mogli równocześnie pracować na jednej liście.  
Kryteria akceptacji:

- Zmiany wprowadzane przez jednego użytkownika (dodawanie, usuwanie, edycja, oznaczenie kupiony) są widoczne u pozostałych użytkowników w czasie zbliżonym do rzeczywistego (docelowo < 1 sekundy przy dobrym łączu).
- W przypadku konfliktów edycji stosowana jest strategia Last Write Wins.
- Aplikacja prezentuje czytelny wskaźnik ładowania podczas nawiązywania połączenia i wykonywania synchronizacji.

US-023  
Tytuł: Limity planów Basic i Premium  
Opis: Jako właściciel konta chcę, aby aplikacja jasno egzekwowała limity mojego planu, aby rozumieć dostępne możliwości.  
Kryteria akceptacji:

- Przy próbie utworzenia drugiej listy jako użytkownik Basic system blokuje operację i informuje o limicie.
- Przy próbie dodania kolejnego produktu ponad limit na liście użytkownika Basic lub Premium system blokuje operację i wyświetla odpowiedni komunikat.
- Jako gość Basic mogę edytować listy Premium, które mają wyższy limit produktów.

US-024  
Tytuł: Fake door dla planu Premium  
Opis: Jako użytkownik zainteresowany większymi limitami chcę móc kliknąć w ofertę Premium i zobaczyć szczegóły, nawet jeśli płatności nie są jeszcze dostępne.  
Kryteria akceptacji:

- W interfejsie dostępny jest element informujący o planie Premium (np. banner, sekcja w ustawieniach).
- Kliknięcie w akcję przejścia na Premium otwiera modal z informacją o korzyściach planu i komunikatem o niedostępności płatności w bieżącej wersji.
- Kliknięcia w ten element mogą być mierzone jako metryka zainteresowania.

US-025  
Tytuł: Korzystanie z aplikacji w trybie offline  
Opis: Jako użytkownik w sklepie z niestabilnym zasięgiem chcę móc korzystać z listy zakupów w trybie offline, aby nie tracić dostępu do listy.  
Kryteria akceptacji:

- Aplikacja może zostać zainstalowana jako PWA na urządzeniu użytkownika.
- Po utracie połączenia użytkownik nadal widzi ostatnią wersję listy.
- Użytkownik może wykonywać podstawowe operacje (dodawanie, oznaczanie, usuwanie produktów), które są synchronizowane po odzyskaniu połączenia.

US-026  
Tytuł: Feedback na akcje użytkownika  
Opis: Jako użytkownik chcę otrzymywać jasne komunikaty o sukcesie lub błędzie moich działań, aby rozumieć, co się dzieje.  
Kryteria akceptacji:

- Przy powodzeniu kluczowych akcji (np. dodanie produktu, utworzenie listy, dołączenie do listy) aplikacja wyświetla krótki komunikat o sukcesie (np. toast).
- Przy błędach (duplikat produktu, przekroczony limit, błędny kod zaproszenia) aplikacja wyświetla jasny komunikat o problemie i ewentualnym sposobie jego rozwiązania.

US-027  
Tytuł: Przeglądanie listy na urządzeniu mobilnym  
Opis: Jako użytkownik korzystający ze smartfona chcę, aby interfejs listy był czytelny i wygodny w obsłudze jedną ręką podczas zakupów.  
Kryteria akceptacji:

- Interfejs jest responsywny i poprawnie wyświetla się na typowych rozdzielczościach mobilnych.
- Główne akcje (dodaj produkt, oznacz kupiony, wyczyść kupione) są łatwo dostępne kciukiem.
- Teksty i elementy interaktywne są wystarczająco duże, aby można było je wygodnie dotknąć.

US-028  
Tytuł: Dostęp do listy tylko dla uprawnionych użytkowników (bezpieczeństwo)  
Opis: Jako właściciel listy chcę mieć pewność, że nikt spoza zaproszonych użytkowników nie ma dostępu do mojej listy.  
Kryteria akceptacji:

- Link z kodem zaproszenia nie daje dostępu do listy użytkownikowi niezalogowanemu (musi się zalogować).
- Kod zaproszenia po upływie 24 godzin przestaje działać.
- System nie udostępnia informacji o liście lub jej nazwie przy użyciu nieprawidłowego kodu.

## 6. Metryki sukcesu

Metryki dotyczące jakości AI:

- Procent automatycznych kategoryzacji, które nie zostały zmienione przez użytkownika (docelowo co najmniej 75 procent).
- Liczba błędów wywołań modelu AI w stosunku do liczby prób (stabilność integracji).
- Współczynnik trafień z cache (odsetek kategoryzacji wykonanych bezpośrednio z cache vs z AI).
