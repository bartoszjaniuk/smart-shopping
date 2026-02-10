<conversation_summary>

<decisions>

1. **Platforma:** Aplikacja Webowa typu PWA (Progressive Web App) z obsługą trybu offline.
2. **Model AI:** Wykorzystanie modelu `openai/gpt-4o-mini` via OpenRouter.
3. **Kategorie:** Zamknięta, predefiniowana lista kategorii (np. Warzywa, Nabiał). Kategoryzacja automatyczna z możliwością ręcznej edycji.
4. **Cache AI:** Globalny słownik (cache) zapamiętujący przypisania (case-insensitive), aby minimalizować zapytania do API.
5. **Sortowanie:** Produkty grupowane kategoriami. Wewnątrz kategorii sortowanie chronologiczne (według kolejności dodania).
6. **Interakcja z produktem:**
   - "Odhaczenie" przenosi produkt na dół listy (przekreślony).
   - "Odznaczenie" (przywrócenie) przenosi produkt na koniec danej kategorii.
   - Usuwanie kupionych: Przycisk "Wyczyść" z modalem potwierdzenia.
   - Duplikaty: Blokada dodania i ostrzeżenie.
   - Limit znaków: 50 znaków na nazwę produktu.

7. **Współdzielenie:**
   - Edycja w czasie rzeczywistym (technologia WebSocket).
   - Zapraszanie przez kod (6 znaków, ważny 24h) lub link.
   - Wymagane konto użytkownika do dołączenia.
   - Role: Owner (pełna kontrola) vs Editor (edycja produktów).

8. **Konta i Ustawienia:**
   - Logowanie email/hasło.
   - Menu użytkownika (Navbar -> Kolko z pierwsza litera maila): Wyloguj, Zmień hasło, Usuń konto.

9. **Logika biznesowa (Limity MVP):**
   - Basic: 1 lista własna, 10 produktów/listę.
   - Premium (flaga w bazie): Nielimitowane listy, 50 produktów/listę.
   - Dziedziczenie: Limity wynikają z konta Właściciela listy (Gość Basic może edytować listę Premium).
   - Dołączone listy nie wliczają się do limitu 1 listy własnej.
   - Płatności: Brak integracji, jedynie "Fake Door" (modal z informacją).

10. **Synchronizacja:** Strategia "Last Write Wins". Wizualizacja ładowania (Skeleton/Loading state).

</decisions>

<matched_recommendations>

1. Implementacja PWA (Progressive Web App) jako kluczowa funkcjonalność dla zakupów w terenie.
2. Zastosowanie sztywnej, startowej listy kategorii.
3. Strategia "Last Write Wins" dla rozwiązywania konfliktów synchronizacji w MVP.
4. Globalny cache dla AI w celu optymalizacji kosztów i szybkości.
5. Prosty model uprawnień (Właściciel vs Gość).
6. Wizualne wskaźniki synchronizacji i stanów ładowania (Skeletons).
7. Ograniczenie palety kolorów list do zestawu pasteli.
8. Dashboard z wyraźnymi akcjami "Nowa lista" i "Dołącz kodem" oraz obsługa Empty State.
9. Zastosowanie mechanizmu "Fake Door" dla funkcji Premium w celu badania zainteresowania.

   </matched_recommendations>

<prd_planning_summary>

**a. Główne wymagania funkcjonalne:**

- **Zarządzanie Listami:** Tworzenie, edycja (nazwa, kolor), usuwanie. Dashboard z kafelkami list.
- **Zarządzanie Produktami:** Dodawanie (z walidacją i trimowaniem), edycja, usuwanie, oznaczanie jako kupione.
- **AI & Kategoryzacja:** Automatyczne przypisywanie kategorii, obsługa błędów (fallback do "Inne"), globalne uczenie się systemu.
- **System Kont:** Rejestracja, logowanie, reset hasła, usuwanie konta, zarządzanie sesją.
- **Kolaboracja:** System zaproszeń (kody/linki), synchronizacja zmian w czasie rzeczywistym, zarządzanie uprawnieniami.

**b. Kluczowe historie użytkownika (User Stories):**

- _Jako użytkownik_, chcę szybko dodać produkt i mieć go automatycznie przypisanego do kategorii, aby nie tracić czasu na formatowanie listy.
- _Jako kupujący_, chcę widzieć produkty pogrupowane kategoriami, aby nie biegać chaotycznie po sklepie.
- _Jako współlokator_, chcę dołączyć do listy zakupów partnera za pomocą kodu, abyśmy mogli wspólnie planować zakupy.
- _Jako użytkownik Basic_, chcę móc edytować dużą listę (50 produktów) udostępnioną mi przez użytkownika Premium, mimo że mój limit osobisty to 10 produktów.

**c. Kryteria sukcesu i mierniki:**

- **Trafność AI:** 75% kategoryzacji bez konieczności edycji przez użytkownika.
- **Wydajność:** Czas synchronizacji zmian między użytkownikami < 1s (przy dobrym łączu).
- **Zaangażowanie:** % użytkowników powracających do aplikacji w ciągu tygodnia.
- **Konwersja (zainteresowanie):** Liczba kliknięć w modal "Kup Premium".

**d. Interfejs i UX:**

- Minimalistyczny design, skupiony na czytelności w ruchu.
- Wyraźne nagłówki kategorii.
- Obsługa stanów pustych (onboarding na Dashboardzie).
- Feedback dla użytkownika (Toasty przy błędach/duplikatach).
  </prd_planning_summary>
  </conversation_summary>
