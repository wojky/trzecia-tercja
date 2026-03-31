# Dokumentacja – Trzecia Tercja

> Aplikacja do śledzenia i analizy uderzeń podczas meczu piłki nożnej.
> Poniżej znajdziesz wyjaśnienie wszystkich wskaźników, modeli i widoków dostępnych w aplikacji.

---

## Czym jest xG? {#xg}

**xG (Expected Goals, pol. _oczekiwane gole_)** to liczba wyrażająca **jakość sytuacji strzeleckiej** – prawdopodobieństwo, że strzał oddany z danej pozycji i w danych warunkach zakończy się golem. Wartość mieści się w przedziale od 0 do 1.

| Przykład | xG | Interpretacja |
|----------|-----|---------------|
| Strzał z 30 metrów, małe okno | 0.03 | 3% szansy na gola |
| Strzał z 12 m, środek, po dośrodkowaniu | 0.18 | 18% szansy |
| Sam na sam z bramkarzem, 8 m | 0.55 | 55% szansy |
| Rzut karny | 0.79 | 79% szansy |

### Co xG mówi, a czego nie mówi

xG **opisuje jakość okazji**, nie jej wynik. Zawodnik, który trafia gola z pozycji xG = 0.04, miał szczęście lub nadzwyczajną technikę – model tego nie rejestruje. Zawodnik, który chybia z pozycji xG = 0.65, stworzył sobie znakomitą szansę — choć bramki nie ma.

Dlatego xG stosuje się głównie w próbkach wielu meczów lub wielu strzałów — wtedy prawo wielkich liczb sprawia, że wartości zaczynają odzwierciedlać rzeczywistość.

### Skąd pochodzi xG?

Koncepcja pojawiła się w środowisku analityki piłkarskiej na przełomie lat 2000/2010. Pionierami byli m.in. **Sam Green** (Opta), **Michael Caley** i **Sander IJtsma**. Dziś xG jest standardem raportowania w Premier League, La Liga i innych ligach.

---

## Modele xG w aplikacji {#models}

Aplikacja udostępnia **pięć modeli xG**. Każdy używa innych zmiennych wejściowych i technik statystycznych. Model aktywny można zmienić w zakładce **Ustawienia** – zmiana dotyczy nowych strzałów; już zapisane wartości pozostają niezmienione.

### Regresja logistyczna – dystans + kąt {#model-logistic}

Klasyczny model oparty na dwóch zmiennych: odległości od bramki (d) i kącie widzenia bramki (θ).

Funkcja logistyczna:

```
xG = 1 / (1 + exp(-(β₀ + β₁·d + β₂·θ)))
```

Współczynniki:

| Typ uderzenia | β₀ | β₁ (dystans) | β₂ (kąt) |
|---|---|---|---|
| Strzał nogą | −3.0 | −0.05 | 3.0 |
| Strzał głową | −3.8 | −0.05 | 2.5 |

Rzut karny: stała wartość **0.79**.

Prostota modelu czyni go dobrym punktem odniesienia, ale nie uwzględnia on m.in. typu akcji ani presji obrońców.

---

### Tylko dystans – model uproszczony {#model-distance}

Najprostszy możliwy model — jedyna zmienna to odległość od bramki. Przydatny jako dolna linia bazowa.

```
xG = 1 / (1 + exp(-(-2.0 + (-0.09)·d)))
```

Strzały głową: dodatkowy mnożnik 0.5. Rzut karny: **0.79**.

Użyteczny edukacyjnie – pokazuje, jak wiele informacji traci model pozbawiony kąta i kontekstu.

---

### Torvaney – Simple xG {#model-torvaney}

Model oparty na pracy statystycznej Toma Torvanea publikowanej we współpracy ze StatsBomb. Uwzględnia **interakcje między dystansem a kątem** oraz typ uderzenia (głowa).

```
logit(xG) = −1.7456
          + 1.3387·θ
          − 0.1104·d
          + 0.6467·h
          + 0.1688·θ·d
          − 0.4249·θ·h
          − 0.1342·d·h
          − 0.0551·θ·d·h
```

Człony interakcji (θ·d, θ·h itd.) sprawiają, że model lepiej radzi sobie ze strzałami z kąta pola karnego – tam gdzie sam dystans lub sam kąt byłyby mylące.

---

### Caley v1 – model eksponencjalny {#model-caley1}

Model Michaela Caleya korzysta z **funkcji wykładniczej** zamiast logistycznej. Oddzielnie traktuje cztery typy strzałów.

```
xG(noga z gry)        = 0.85 · exp(−0.13 · d_adj)
xG(głowa z gry)       = 1.13 · exp(−0.27 · d_adj)
xG(noga po dośr.)     = 0.97 · exp(−0.19 · d_adj)
xG(głowa po dośr.)    = 0.65 · exp(−0.21 · d_adj)
```

`d_adj` to dostosowana odległość od środka bramki (nie od linii bramkowej). Wartości xG są ograniczone funkcją logistyczną do zakresu (0, 1).

---

### Caley v2 – regresja logistyczna {#model-caley2}

Rozwinięta wersja modelu Caleya oparta na **regresji logistycznej** z czterema osobnymi zestawami współczynników dla każdego z typów strzałów. Wykazuje wyższą zgodność z danymi empirycznymi niż v1.

Przykład (głowa po dośrodkowaniu):
```
logit(xG) = −2.88 − 0.21·d + 2.13·relAngle
```

gdzie `relAngle` to kąt względem środka bramki (w radianach).

---

## xA – Expected Assists {#xa}

**xA (Expected Assists, pol. _oczekiwane asysty_)** mierzy wartość podań prowadzących do strzałów.

Dla każdego strzału poprzedzonego podaniem, wartość xG tego strzału jest **przypisywana podającemu** jako jego xA:

```
xA zawodnika = suma xG wszystkich strzałów, do których zagrał kluczowe podanie
```

**Przykład:** Zawodnik A dał trzy podania kończące się strzałami o xG = 0.12, 0.08 i 0.31. Jego xA = 0.51.

xA pozwala docenić **kreatorów gry** — zawodników, którzy regularnie tworzą groźne sytuacje, nawet jeśli bramka nie pada.

### xA a tradycyjna asysta

Tradycyjna asysta rejestruje jedynie podanie bezpośrednio poprzedzające gola. xA uwzględnia *wszystkie* niebezpieczne podania — niezależnie od efektu strzeleckiego.

---

## xD – Expected Danger {#xd}

**xD (Expected Danger, pol. _oczekiwane zagrożenie_)** to łączny wkład zawodnika w tworzenie sytuacji bramkowych – jako strzelec **i** jako podający:

```
xD = xG + xA
```

xD jest szczególnie przydatne przy ocenie skrzydłowych i środkowych pomocników, którzy wchodzą w obie role.

**Przykład:** Zawodnik oddał strzały o łącznej wartości xG = 0.45 i zagrał podania o łącznej wartości xA = 0.38. Jego xD = 0.83.

---

## Wskaźniki efektywności {#efficiency}

### xG / strzał

Średnia jakość sytuacji strzeleckiej:

```
xG / strzał = xG zawodnika / liczba strzałów
```

Wyższy wynik → zawodnik strzela z lepszych pozycji. Pozwala odróżnić zawodnika „szukającego okazji" od „bombardującego z dystansu".

### xA / podanie (próby asyst)

Średnia wartość xG sytuacji powstałych po podaniach:

```
xA / podanie = xA zawodnika / liczba prób asyst
```

Wyższy wynik → podania zawodnika kończą się groźniejszymi strzałami.

### xD / minutę

Normalizuje wkład do zagrożenia względem czasu spędzonego na boisku:

```
xD / min = xD / minuty gry
```

Pozwala porównywać zawodników o różnym czasie gry — np. rezerwowych wchodzących na 20 minut.

---

## Akumulowane xG (wykres) {#cumulative-xg}

Wykres akumulowanego xG pokazuje **narastającą sumę wartości xG** kolejnych strzałów w ciągu meczu – osobno dla każdej drużyny.

```
xG_skum(t) = xG₁ + xG₂ + ... + xGₜ
```

### Co odczytujemy z wykresu?

| Kształt krzywej | Interpretacja |
|-----------------|---------------|
| Stromość ↑ | „Burza strzałów" — wiele groźnych sytuacji w krótkim czasie |
| Płaski odcinek | Brak groźnych okazji — mecz się wyrównał lub drużyna oddała inicjatywę |
| Wysoka krzywa przy małej liczbie goli | Dobra jakość okazji, pech lub świetny bramkarz przeciwnika |
| Niska krzywa przy golu | Gol z okazji poniżej oczekiwania (= niski xG) |

### xG a wynik meczu

Różnica akumulowanego xG po zakończeniu meczu (nazywana **xGD** – _xG Difference_) jest jednym z lepszych prognozatorów przyszłych wyników drużyny.

---

## Symulacja meczu {#simulation}

Zakładka **Symulacja** oblicza rozkład prawdopodobieństwa liczby goli dla każdej drużyny na podstawie zarejestrowanych strzałów.

### Metoda: splot PMF

Każdy strzał traktujemy jako niezależną zmienną Bernoulliego z parametrem `p = xG`. Liczba goli drużyny to suma takich zmiennych.

Rozkład tej sumy obliczamy **rekurencyjnym splotem** (ang. _convolution_):

1. Startujemy od rozkładu jednoelementowego: P(0 goli) = 1
2. Dla każdego kolejnego strzału `i` o wartości `xGᵢ`:

```
P'(k) = P(k) · (1 − xGᵢ) + P(k−1) · xGᵢ
```

3. Po przetworzeniu wszystkich strzałów mamy PMF (ang. _Probability Mass Function_): P(0), P(1), P(2), ...

### Wyniki symulacji

| Wynik | Jak jest liczony |
|-------|-----------------|
| Wygrana / Remis / Porażka | Suma iloczynów P(i goli nasze) × P(j goli ryw.) dla odpowiednich i,j |
| Oczekiwane gole | Średnia rozkładu PMF (= suma xG drużyny) |
| Odchylenie standardowe | Odchylenie standardowe rozkładu PMF |
| PPG (punkty na mecz) | 3 × P(wygrana) + 1 × P(remis) |

### Ograniczenia symulacji

Model zakłada **niezależność** strzałów i **stałe xG**. W rzeczywistości wyniki w piłce nożnej mają grubsze ogony rozkładu (tzw. _overdispersion_) — zdarzenia losowe, zmęczenie, zmiany taktyczne zaburzają założenia modelu.

---

## Macierz współpracy {#collab-matrix}

Macierz współpracy pokazuje, ile razy para zawodników uczestniczyła razem w tworzeniu sytuacji strzeleckiej (strzelec + podający).

### Tryby widoku

| Tryb | Wiersz | Kolumna |
|------|--------|---------|
| **asysta → uderzenie** | Podający (assistujący) | Strzelec |
| **uderzenie ← asysta** | Strzelec | Podający |
| **razem** | Dowolny zawodnik | Dowolny zawodnik (symetrycznie) |

Liczba w komórce to **liczba akcji** między daną parą w rejestrowanym meczu.

Macierz pozwala szybko zidentyfikować **duety i trio zawodników** najczęściej współpracujących przy tworzeniu zagrożenia.

---

## Porównanie zawodników {#player-comparison}

Zakładka **Zawodnicy** umożliwia wybór **maksymalnie 3 zawodników** i porównanie ich na wykresie radarowym.

### Normalizacja osi

Każda oś wykresu jest **znormalizowana do maksymalnej wartości w meczu** = 1.0. Dzięki temu zawodnicy z absolutnie różnymi statystykami są porównywani proporcjonalnie w obrębie kontekstu tego meczu.

### Wskaźniki na wykresie radarowym

| Wskaźnik | Opis |
|----------|------|
| xG | Suma wartości xG ze strzałów |
| xA | Suma wartości xA z podań |
| xD | xG + xA |
| Strzały | Łączna liczba oddanych strzałów |
| Gole | Liczba strzałów zakończonych golem |
| Celne | Liczba celnych strzałów (trafienie w bramkę lub gol) |

### Tabela porównawcza

Tabela poniżej wykresu zawiera wartości bezwzględne. **Najlepszy wynik** w każdym wierszu jest podświetlony.

---

## Źródła {#sources}

| Autor | Tytuł | Link |
|-------|-------|------|
| Michael Caley | *Shot Matrix I: Making Sense of Shot Statistics* | [cartilagefreecaptain.com](https://cartilagefreecaptain.com/2013/09/23/shot-matrix-i-making-sense-of-shot-statistics/) |
| Michael Caley | *Shot Matrix III: What Makes a Good Shot?* | [cartilagefreecaptain.com](https://cartilagefreecaptain.com/2014/01/14/shot-matrix-iii-what-makes-a-good-shot/) |
| Tom Torvaney | *A Simple Expected Goals Model* | [statsbomb.com](https://statsbomb.com/articles/soccer/a-simple-expected-goals-model/) |
| Łukasz Szczepański, Ian McHale | *Assist value in association football* | [JRSS-A](https://academic.oup.com/jrsssa/article-abstract/179/3/719/7083779) |
| William Spearman | *Beyond Expected Goals* | [MIT Sloan 2018](https://www.sloansportsconference.com/research-papers/beyond-expected-goals) |
| Martin Eastwood | *Expected Goals for All* | [pena.lt/y](https://pena.lt/y/2015/12/01/probability-of-scoring/) |

---

*Dokumentacja dotyczy aplikacji Trzecia Tercja. Modele xG zostały zaimplementowane na podstawie publicznie dostępnych badań — nie były trenowane na własnych danych meczowych. Wartości xG mają charakter orientacyjny.*
