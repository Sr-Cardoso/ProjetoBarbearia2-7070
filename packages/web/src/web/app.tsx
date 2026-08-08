import { Route, Switch } from "wouter";
import Index from "./pages/index";
import Agendar from "./pages/agendar";
import Loja from "./pages/loja";
import Entrar from "./pages/entrar";
import Conta from "./pages/conta";
import Admin from "./pages/admin";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/agendar" component={Agendar} />
        <Route path="/loja" component={Loja} />
        <Route path="/entrar" component={Entrar} />
        <Route path="/conta" component={Conta} />
        <Route path="/admin" component={Admin} />
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
