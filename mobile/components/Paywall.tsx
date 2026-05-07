// @ts-nocheck
import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Purchases from 'react-native-purchases';
import { useSubscription } from '../context/SubscriptionContext';

const BENEFITS = [
  { icon: '🔊', title: 'Tatoeba例文の音声読み上げ', desc: '生きた英文を耳でも確認' },
  { icon: '🖼️', title: 'メモへの画像添付', desc: 'ビジュアルと一緒に暗記' },
  { icon: '∞', title: '1日追加上限の撤廃', desc: '好きなだけ単語を追加（近日公開）' },
  { icon: '📊', title: '詳細な学習統計', desc: '学習傾向の深い分析（近日公開）' },
];

export default function Paywall() {
  const { showPaywall, setShowPaywall, isPremium } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Dev mode toggle for testing without a real RevenueCat key
  const [devPremium, setDevPremium] = useState(false);

  if (!showPaywall) return null;

  async function handlePurchase() {
    setPurchasing(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (!pkg) {
        Alert.alert('購入できません', '現在このプランは利用できません。');
        return;
      }
      await Purchases.purchasePackage(pkg);
      setShowPaywall(false);
    } catch (e: unknown) {
      if (!e?.userCancelled) {
        Alert.alert('エラー', '購入に失敗しました。もう一度お試しください。');
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
      if (hasPremium) {
        Alert.alert('復元完了', 'プレミアムが復元されました！');
        setShowPaywall(false);
      } else {
        Alert.alert('プレミアムなし', 'プレミアムのご購入が見つかりませんでした。');
      }
    } catch {
      Alert.alert('エラー', '復元に失敗しました。');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPaywall(false)}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPaywall(false)}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.title}>Sprightly Premium</Text>
          <Text style={styles.subtitle}>英単語学習をもっと豊かに</Text>

          <View style={styles.benefitsList}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>{b.icon}</Text>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.priceBox}>
            <Text style={styles.price}>¥480 / 月</Text>
            <Text style={styles.priceNote}>いつでもキャンセル可能</Text>
          </View>

          <TouchableOpacity
            style={[styles.purchaseBtn, purchasing && styles.btnDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseBtnText}>プレミアムを始める</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Text style={styles.restoreBtnText}>
              {restoring ? '復元中…' : '購入を復元する'}
            </Text>
          </TouchableOpacity>

          {/* Dev mode toggle — remove before production */}
          <TouchableOpacity style={styles.devBtn} onPress={() => setDevPremium(!devPremium)}>
            <Text style={styles.devBtnText}>
              [DEV] プレミアムをシミュレート: {devPremium ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            購入はApple IDアカウントに請求されます。サブスクリプションは自動更新されます。
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  closeBtn: { position: 'absolute', top: 16, right: 20, zIndex: 10, padding: 8 },
  closeBtnText: { color: '#94a3b8', fontSize: 18 },
  scroll: { padding: 24, paddingTop: 56, alignItems: 'center' },
  crown: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f1f5f9', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#94a3b8', marginTop: 6, marginBottom: 28 },
  benefitsList: { width: '100%', gap: 16, marginBottom: 28 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#1e293b', borderRadius: 14, padding: 14 },
  benefitIcon: { fontSize: 24, marginTop: 2 },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', marginBottom: 2 },
  benefitDesc: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  priceBox: { alignItems: 'center', marginBottom: 20 },
  price: { fontSize: 26, fontWeight: 'bold', color: '#818cf8' },
  priceNote: { fontSize: 13, color: '#64748b', marginTop: 4 },
  purchaseBtn: { width: '100%', backgroundColor: '#4f46e5', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  purchaseBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  restoreBtn: { paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: '#818cf8', textDecorationLine: 'underline' },
  devBtn: { marginTop: 16, paddingVertical: 8 },
  devBtnText: { fontSize: 11, color: '#475569' },
  legal: { fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
