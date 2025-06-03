# PrivMX Documentation MCP Server

Inteligentny serwer Model Context Protocol (MCP), który zapewnia asystentom AI semantyczny dostęp do dokumentacji PrivMX WebEndpoint poprzez embeddingi wektorowe i zaawansowane przetwarzanie dokumentów.

## 🎯 Co to robi

Ten serwer MCP przekształca dokumentację PrivMX w bazę wiedzy dostępną dla AI, która może:

- **Odpowiadać na złożone pytania** dotyczące API z dokładnymi, kontekstowymi odpowiedziami
- **Dostarczać kompletne przykłady kodu** dla konkretnych przypadków użycia
- **Sugerować najlepsze praktyki** i typowe wzorce
- **Pomagać w rozwiązywaniu problemów** z szczegółowymi rozwiązaniami
- **Prowadzić deweloperów** przez wieloetapowe przepływy pracy

## 📋 Status Projektu

### ✅ Ukończone Fazy
- **Faza 1**: Konfiguracja projektu i struktura monorepo
- **Faza 2**: System parsowania dokumentacji (JSON + MDX)
- **Faza 3**: Inteligentne strategie dzielenia na fragmenty
- **Faza 3.5**: Testy jednostkowe i integracyjne

### 🔍 Szczegóły Implementacji
- **4 Strategie dzielenia**: Method-level, Context-aware, Hierarchical, Hybrid
- **System wzbogacania**: Automatyczne dodawanie kontekstu i metadanych
- **Optymalizacja fragmentów**: Jakość, deduplikacja, łączenie/podział
- **Walidacja**: Kompletny system sprawdzania poprawności
- **Testy**: Pokrycie jednostkowe i integracyjne

### ⚠️ W Trakcie
- **Faza 4**: Generowanie embeddingów OpenAI
- **Faza 5**: Integracja z bazą danych wektorowych

## 🏗 Architektura Monorepo

```
privmx-mcp-workspace/
├── packages/
│   ├── shared/              # Współdzielone typy i narzędzia
│   └── mcp-server/          # Główny serwer MCP
├── apps/
│   └── cli/                 # Narzędzie CLI do zarządzania
├── spec/                    # Pliki dokumentacji źródłowej
│   ├── out.js.json         # Strukturalna dokumentacja API
│   └── mdx/                # Przyjazne dla człowieka tutoriale
└── docs/                    # Dokumentacja projektu
```

## 🚀 Szybki Start

### Wymagania wstępne
- Node.js 18+
- pnpm 9.0+
- Klucz API OpenAI
- Docker (opcjonalnie, dla bazy danych wektorowych)

### Instalacja

```bash
# Sklonuj repozytorium
git clone <repository-url>
cd privmx-mcp-workspace

# Zainstaluj zależności
pnpm install

# Zbuduj wszystkie pakiety
pnpm build

# Uruchom testy
pnpm test

# Inicjalizuj konfigurację
pnpm cli init
```

### Uruchomienie serwera

```bash
# Uruchom bazę danych wektorowych (Chroma)
docker run -p 8000:8000 chromadb/chroma

# Indeksuj dokumentację
pnpm cli index

# Uruchom serwer MCP
pnpm mcp-server start
```

### Testowanie

```bash
# Uruchom wszystkie testy
pnpm test

# Uruchom testy komponentów (szybkie)
pnpm test:components

# Uruchom testy w trybie watch
pnpm test:watch

# Sprawdź pokrycie testów
pnpm test:coverage

# Testuj konkretny pakiet
cd packages/mcp-server
pnpm test
```

## 📦 Pakiety

### [@privmx/shared](./packages/shared)
Współdzielone typy TypeScript i narzędzia używane przez wszystkie komponenty.

### [@privmx/mcp-server](./packages/mcp-server)
Główny serwer MCP implementujący:
- Parsowanie dokumentacji JSON i MDX
- Inteligentne dzielenie na fragmenty
- Generowanie embeddingów OpenAI
- Semantyczne wyszukiwanie wektorowe
- Narzędzia protokołu MCP

### [@privmx/mcp-cli](./apps/cli)
Narzędzie wiersza poleceń do:
- Inicjalizacji konfiguracji
- Indeksowania dokumentacji
- Zarządzania serwerem
- Testowania funkcjonalności

## 🛠 Rozwój

```bash
# Uruchom wszystkie pakiety w trybie dev
pnpm dev

# Uruchom testy
pnpm test

# Sprawdź typy
pnpm check-types

# Formatuj kod
pnpm format

# Sprawdź linting
pnpm lint
```

## 📖 Dokumentacja

- [Przewodnik konfiguracji](./docs/configuration.md)
- [Rozwój API](./docs/api-development.md)
- [Strategie dzielenia na fragmenty](./docs/chunking-strategies.md)
- [Integracja bazy danych wektorowych](./docs/vector-database.md)

## 🤝 Udział w rozwoju

1. Forkuj repozytorium
2. Utwórz branch funkcji (`git checkout -b feature/amazing-feature`)
3. Zatwierdź zmiany (`git commit -m 'Add amazing feature'`)
4. Wypchnij do brancha (`git push origin feature/amazing-feature`)
5. Otwórz Pull Request

## 📄 Licencja

Ten projekt jest licencjonowany na licencji MIT - zobacz plik [LICENSE](LICENSE) dla szczegółów.

## 🆘 Wsparcie

- **Dokumentacja**: [Pełna dokumentacja API](docs/)
- **Problemy**: [GitHub Issues](https://github.com/your-org/privmx-mcp-workspace/issues)
- **Dyskusje**: [GitHub Discussions](https://github.com/your-org/privmx-mcp-workspace/discussions)

---

**Zbudowany z ❤️ dla społeczności deweloperów PrivMX**
