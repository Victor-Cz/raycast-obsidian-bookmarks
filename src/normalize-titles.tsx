import { ApplicationsProvider } from "./hooks/use-applications";
import { PreferencesProvider } from "./hooks/use-preferences";
import NormalizeTitles from "./views/NormalizeTitles";
import VaultInspector from "./views/VaultInspector";

export default function () {
  return (
    <ApplicationsProvider>
      <PreferencesProvider>
        <VaultInspector>
          <NormalizeTitles />
        </VaultInspector>
      </PreferencesProvider>
    </ApplicationsProvider>
  );
}
