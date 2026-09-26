import type { Locale, SessionView, ToolAction } from '../../shared/contract.ts';

export function toolLabel(name: string | null | undefined, locale: Locale = 'tr'): string {
  const n = (name ?? '').toLowerCase();
  const tr = locale === 'tr';
  if (!n) return tr ? 'Hazır' : 'Ready';
  if (/request_user_input|ask_user/.test(n)) return tr ? 'Soru soruyor' : 'Asking a question';
  if (/(?:^|[._:])sleep$/.test(n)) return tr ? 'Kaytarıyor' : 'Taking a break';
  if (/wait|write_stdin/.test(n)) return tr ? 'Sonucu bekliyor' : 'Waiting for results';
  if (/exec_command|run_command/.test(n)) return tr ? 'Komut çalıştırıyor' : 'Running a command';
  if (/(?:^|[.:])exec$/.test(n)) return tr ? 'İşlem yapıyor' : 'Working';
  if (/apply_patch|replace_|insert_|write_file/.test(n))
    return tr ? 'Dosyayı düzenliyor' : 'Editing a file';
  if (/create_text_file/.test(n)) return tr ? 'Dosya oluşturuyor' : 'Creating a file';
  if (/read_file|read_text|read_thread_terminal/.test(n))
    return tr ? 'Dosyayı inceliyor' : 'Reading';
  if (/context7|resolve_library|query_docs/.test(n))
    return tr ? 'Belgeleri inceliyor' : 'Reading documentation';
  if (/search|find_|rg/.test(n)) return tr ? 'Araştırıyor' : 'Searching';
  if (/view_image|screenshot|browser|playwright/.test(n))
    return tr ? 'Görünümü kontrol ediyor' : 'Checking the view';
  if (/session_|memory|lemma/.test(n))
    return tr ? 'Çalışma kaydını güncelliyor' : 'Updating work notes';
  if (/agent|thread/.test(n)) return tr ? 'Ekibi kontrol ediyor' : 'Checking the team';
  if (/open_in_codex/.test(n)) return tr ? 'Önizlemeyi açıyor' : 'Opening a preview';
  return tr ? 'Araç kullanıyor' : 'Using a tool';
}

export function activityLabel(session: SessionView | undefined, locale: Locale): string {
  if (!session) return locale === 'tr' ? 'Bağlı oturum yok' : 'No linked session';
  if (session.pendingQuestions?.length || session.status === 'waiting')
    return locale === 'tr' ? 'Yanıtını bekliyor' : 'Waiting for your answer';
  if (session.status === 'idle') return locale === 'tr' ? 'Kaytarıyor' : 'Taking a break';
  if (session.status === 'interrupted') return locale === 'tr' ? 'İşi durduruldu' : 'Interrupted';
  if (session.status === 'unknown') return locale === 'tr' ? 'Durumu bilinmiyor' : 'Unknown status';
  return toolLabel(session.currentTool, locale);
}

export function actionLabel(action: ToolAction, locale: Locale): string {
  const labels =
    locale === 'tr'
      ? {
          command: 'Komut',
          read: 'Dosya okuma',
          edit: 'Dosya düzenleme',
          create: 'Dosya oluşturma',
          delete: 'Dosya silme',
          tool: toolLabel(action.toolName, locale),
        }
      : {
          command: 'Command',
          read: 'Read file',
          edit: 'Edit file',
          create: 'Create file',
          delete: 'Delete file',
          tool: toolLabel(action.toolName, locale),
        };
  return labels[action.kind];
}
